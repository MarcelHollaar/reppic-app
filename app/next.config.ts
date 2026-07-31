import { withSentryConfig } from "@sentry/nextjs";
const path = require("path");
const loaderUtils = require("loader-utils");
const MangleCssClassPlugin = require("mangle-css-class-webpack-plugin");
// next.config.js
const { i18n } = require("./i18next.config.js");
const { withAxiom } = require("next-axiom");

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  i18n,
  async headers() {
    // Security headers on every response (clickjacking, MIME sniffing,
    // transport, base-tag injection). CSP is intentionally limited to
    // frame-ancestors/object-src/base-uri so it can't break the app's own
    // inline scripts/styles.
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains",
      },
      {
        key: "Content-Security-Policy",
        value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
      },
    ];

    // CORS: pair credentials only with a specific origin — never with "*"
    // (the browser rejects that combination and it signals loose intent).
    const corsOrigin =
      process.env.CORS_ALLOW_ORIGIN || process.env.APP_URL || "";
    const corsHeaders = [
      ...(corsOrigin
        ? [
            { key: "Access-Control-Allow-Origin", value: corsOrigin },
            { key: "Access-Control-Allow-Credentials", value: "true" },
          ]
        : [{ key: "Access-Control-Allow-Origin", value: "*" }]),
      {
        key: "Access-Control-Allow-Methods",
        value: "GET, DELETE, PATCH, POST, PUT, OPTIONS",
      },
      {
        key: "Access-Control-Allow-Headers",
        value:
          "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
      },
    ];

    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: corsHeaders },
    ];
  },

  env: {
    APP_BASE_URL: process.env.APP_BASE_URL,
    ENVIRONMENT: process.env.ENVIRONMENT,
  },

  webpack: (config, { dev }) => {
    const rules = config.module.rules
      .find((rule) => typeof rule.oneOf === "object")
      .oneOf.filter((rule) => Array.isArray(rule.use));

    if (!dev)
      rules.forEach((rule) => {
        rule.use.forEach((moduleLoader) => {
          if (
            moduleLoader.loader?.includes("css-loader") &&
            !moduleLoader.loader?.includes("postcss-loader")
          ) {
            if (moduleLoader.options.modules?.getLocalIdent) {
              return (moduleLoader.options.modules.getLocalIdent = (
                context,
                _,
                exportName
              ) =>
                loaderUtils
                  .getHashDigest(
                    Buffer.from(
                      `filePath:${path
                        .relative(context.rootContext, context.resourcePath)
                        .replace(/\\+/g, "/")}#className:${exportName}`
                    ),
                    "md4",
                    "base64",
                    6
                  )
                  .replace(/^(-?\d|--)/, "_$1"));
            }
          }
        });
      });

    if (!dev) {
      config.plugins.push(
        new MangleCssClassPlugin({
          classNameRegExp:
            "((hover|focus|active|disabled|visited|first|last|odd|even|group-hover|focus-within|xs|sm|md|lg|xl)[\\\\]*:)*(tw)-[a-zA-Z0-9_-]*([\\\\]*/[0-9]*)?",
          ignorePrefixRegExp:
            "((hover|focus|active|disabled|visited|first|last|odd|even|group-hover|focus-within|xs|sm|md||lg|xl)[\\\\]*:)*",
          log: false,
          classGenerator: (original) => {
            const newClass = original
              .replace(/tw-/g, "")
              .replace(/grid/, "g")
              .replace(/auto/, "au")
              .replace(/border/g, "b")
              .replace(/center/g, "ctr")
              .replace(/rounded/g, "rd")
              .replace(/max-content/, "mc")
              .replace(/maxcontent/, "mc")
              .replace(/-/g, "")
              .replace(/#/g, "")
              .replace(/sm:/, "1")
              .replace(/md:/, "2")
              .replace(/lg:/, "3")
              .replace(/xl:/, "4")
              .replace(/\[/, "")
              .replace(/\]/, "");

            return btoa(newClass).replace(/=/g, "");
          },
        })
      );
    }

    config.resolve.alias.canvas = false;

    return config;
  },
};

const configWithAxiom = withAxiom(nextConfig);

export default withSentryConfig(configWithAxiom, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "my-tech-partner",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
});
