import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ComponentType } from "react";
import React from "react";

function authMiddleware<P extends object>(Component: ComponentType<P>, requiredRole?: string, allowContactManager: boolean = false) {
    return function AuthWrapper(props: P) {
        const router = useRouter();
        const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

        useEffect(() => {
            const userData = localStorage.getItem("user_data");
            const token = localStorage.getItem("token");

            if (!token || !userData) {
                localStorage.removeItem("user_data");
                localStorage.removeItem("token");
                router.replace("/auth/signin/basic");
                return;
            }

            try {
                const user = JSON.parse(userData);
                const decodedToken = JSON.parse(atob(token.split(".")[1]));

                // Check if the token is expired
                if (decodedToken.exp * 1000 < Date.now()) {
                    localStorage.removeItem("user_data");
                    localStorage.removeItem("token");
                    localStorage.setItem("tokenExpired", "true");
                    router.replace("/auth/signin/basic");
                    return;
                }

                // Check role-based authorization if required.
                // superadmin is the highest role and may access any role-gated route.
                const isRoleMatch = requiredRole
                    ? user.role?.name === requiredRole || user.role?.name === "superadmin"
                    : true;
                const isContactManager = user?.is_company_contact_manager === true;

                if (!isRoleMatch && !(allowContactManager && isContactManager)) {
                    localStorage.setItem("dashboardRedirect", "true");
                    router.replace("/dashboard");
                    return;
                }

                // Only set authenticated to true if all checks pass
                setIsAuthenticated(true);
            } catch (error) {
                console.error("Error in authMiddleware:", error);
                localStorage.removeItem("user_data");
                localStorage.removeItem("token");
                router.replace("/auth/signin/basic");
            }
        }, []);

        // Show nothing during authentication check
        if (isAuthenticated === null) {
            return React.createElement(
                "div", 
                { 
                    style: {
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "100vh"
                    }
                },
                React.createElement("div", {
                    style: {
                        width: "3rem",
                        height: "3rem",
                        borderRadius: "50%",
                        borderTop: "2px solid #3b82f6",
                        borderBottom: "2px solid #3b82f6",
                        animation: "spin 1s linear infinite"
                    }
                })
            );
        }


        // Only render the component if authenticated
        return isAuthenticated ? React.createElement(Component, props) : null;
    };
}

export default authMiddleware;
