import {NextRequest, NextResponse} from "next/server";
import crypto from "crypto";
import {z} from "zod";
import {CompanyService} from "@/app/api/services/companyService";

export const runtime = "nodejs";

const ACCEPTED_EVENT_TYPE = "purchase.created" as const;

const WEBHOOK_SIGNING_SECRET = process.env.WEBHOOK_SIGNING_SECRET;
const SURECART_API_SECRET_KEY = process.env.SURECART_API_SECRET_KEY;

type SureCartEvent<T = any> = {
    id: string;
    object: "event";
    type: string;
    account: string;
    created_at: number;
    data: { object: T };
};

type PurchaseObject = {
    id: string;
    object: "purchase";
    live_mode: boolean;
    quantity: number;
    customer: string;
    initial_order?: string | null;
    price: string;
    product: string;
    subscription?: string | null;
    created_at: number;
    updated_at: number;
};

const UpsertSchema = z.object({
    companyName: z.string().min(1, "companyName is required"),
    user: z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
    }),
    maxUsers: z.number().int().min(1),
    langCode: z.string().optional(),
});

function timingSafeEqualHex(a: string, b: string) {
    const aBuf = Buffer.from(a, "utf8");
    const bBuf = Buffer.from(b, "utf8");
    return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
}
function pick<T>(...vals: (T | undefined | null)[]) {
    for (const v of vals) if (v !== undefined && v !== null && v !== "") return v as T;
    return undefined;
}

export async function POST(req: NextRequest) {
    const raw = await req.text();


    const signature = req.headers.get("x-webhook-signature");
    const timeStamp  = req.headers.get("x-webhook-timestamp");

    if (!signature || !timeStamp) {
        return NextResponse.json({ message: "Missing signature/timestamp" }, { status: 401 });
    }

    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(Number(timeStamp)) || Math.abs(now - Number(timeStamp)) > 300) {
        return NextResponse.json({ message: "Timestamp too old" }, { status: 401 });
    }

    const signed = `${timeStamp}.${raw}`;
    const expected = crypto
        .createHmac("sha256", WEBHOOK_SIGNING_SECRET!)
        .update(signed, "utf8")
        .digest("hex");

    if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
        return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
    }

    let evt: SureCartEvent<PurchaseObject>;
    try {
        evt = JSON.parse(raw);
    } catch {
        return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }

    if (evt.type !== ACCEPTED_EVENT_TYPE) {
        return NextResponse.json({ ok: true, ignored: evt.type }, { status: 200 });
    }

    const purchase = evt.data?.object;
    const orderId = purchase?.initial_order;
    if (!orderId) {
        return NextResponse.json({ ok: true, reason: "no initial_order on purchase" }, { status: 200 });
    }

    const sureCartApiUrl = new URL(`https://api.surecart.com/v1/orders/${orderId}`);
    sureCartApiUrl.searchParams.append("expand[]", "checkout");
    sureCartApiUrl.searchParams.append("expand[]", "checkout.customer");
    sureCartApiUrl.searchParams.append("expand[]", "checkout.line_items");


    const orderRes = await fetch(sureCartApiUrl.toString(), {
        headers: { Authorization: `Bearer ${SURECART_API_SECRET_KEY}` },
        cache: "no-store",
    });

    if (!orderRes.ok) {
        const body = await orderRes.text().catch(() => "");
        return NextResponse.json(
            { message: "Failed to fetch order from SureCart", status: orderRes.status, body },
            { status: 502 }
        );
    }

    const order = await orderRes.json();
    const checkout = order?.checkout ?? {};
    const meta = checkout?.metadata ?? {};


    const firstName = pick<string>(checkout.first_name, checkout.name?.split(" ")?.[0]);
    const lastName = pick<string>(checkout.last_name, checkout.customer?.last_name);
    const fullName =
        pick<string>(checkout.name, checkout.customer?.name) ??
        [firstName, lastName].filter(Boolean).join(" ").trim();

    const email = pick<string>(checkout.email, checkout.customer?.email);
    const phone = pick<string>(meta.phonenumber, meta.phone, checkout.phone, checkout.customer?.phone);

    const companyName =
        pick<string>(meta.company, meta.companyName, meta.company_name) ?? "Unknown Company";



    const li = order?.checkout?.line_items;
    const itemsToCount = Array.isArray(li) ? li : li?.data ?? [];

    const quantity = itemsToCount.reduce((sum: number, it: any) => {
        const q = Number(it?.quantity);
        return sum + (Number.isFinite(q) && q > 0 ? q : 1);
    }, 0);

    const maxUsers =
        (quantity > 0 ? quantity : undefined) ??
        (Number(purchase?.quantity) || 1);


    const langCode = pick<string>(
        meta.lang,
        meta.locale,
        meta.NEXT_LOCALE,
        meta.language,
        (() => {
            try {
                const page = checkout?.page_url ?? meta.page_url;
                if (!page) return undefined;
                const u = new URL(page);
                return u.searchParams.get("lang") || u.searchParams.get("locale") || undefined;
            } catch {
                return undefined;
            }
        })()
    );

    let upsertInput: z.infer<typeof UpsertSchema>;
    try {
        upsertInput = UpsertSchema.parse({
            companyName,
            user: { name: fullName || "New Customer", email, phone },
            maxUsers,
            langCode,
        });
    } catch (e: any) {
        return NextResponse.json({ message: "Invalid mapped input", issues: e?.issues }, { status: 422 });
    }


    const company= await CompanyService.upsertCompanyAndInviteFromWebhook(upsertInput);

    return NextResponse.json({ message: "User Account and company created succesfully", company }, { status: 200 });
}
