import { createRouter, createWebHistory } from "vue-router";
import { session, type Role } from "./lib/api";

declare module "vue-router" {
  interface RouteMeta { title?: string; roles?: Role[] }
}

const page = (name: string) => () => import(`./pages/${name}.vue`);
const console_ = (name: string) => () => import(`./pages/console/${name}.vue`);
const STAFF: Role[] = ["admin", "operator"];

export const homeFor = (role?: Role) => (!role ? "/sign-in" : role === "platform" ? "/app/platform" : "/app/dashboard");

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: (to) => (to.hash ? { el: to.hash, behavior: "smooth" } : { top: 0 }),
  routes: [
    { path: "/", component: page("Home"), meta: { title: "Legitify" } },
    { path: "/institutions", component: page("Institutions"), meta: { title: "For institutions" } },
    { path: "/verifiers", component: page("Verifiers"), meta: { title: "For employers and verifiers" } },
    { path: "/developers", component: page("Developers"), meta: { title: "For developers" } },
    { path: "/verify", component: page("Verify"), meta: { title: "Check a document" } },
    { path: "/v/:id", component: page("Credential"), meta: { title: "Credential record" } },
    { path: "/request", component: page("RequestNew"), meta: { title: "Ask an institution" } },
    { path: "/track/:token", component: page("RequestTrack"), meta: { title: "Your request" } },
    { path: "/shared/:token", component: page("Shared"), meta: { title: "Shared certificate" } },
    { path: "/sign-in", component: page("SignIn"), meta: { title: "Staff sign-in" } },
    {
      path: "/app",
      component: () => import("./components/console/ConsoleLayout.vue"),
      children: [
        { path: "", redirect: () => homeFor(session.current?.role) },
        { path: "dashboard", component: console_("Dashboard"), meta: { title: "Dashboard", roles: STAFF } },
        { path: "inbox", component: page("Inbox"), meta: { title: "Inbox", roles: STAFF } },
        { path: "requests/:id", component: page("RequestDetail"), meta: { title: "Request", roles: STAFF } },
        { path: "documents", component: console_("Documents"), meta: { title: "Documents", roles: STAFF } },
        { path: "documents/:id", component: console_("DocumentDetail"), meta: { title: "Document details", roles: STAFF } },
        { path: "operators", component: console_("Operators"), meta: { title: "Operators", roles: ["admin"] } },
        { path: "settings", component: console_("Settings"), meta: { title: "Settings", roles: ["platform", ...STAFF] } },
        { path: "platform", component: console_("PlatformDashboard"), meta: { title: "Dashboard", roles: ["platform"] } },
        { path: "platform/institutions", component: console_("PlatformInstitutions"), meta: { title: "Institutions", roles: ["platform"] } },
      ],
    },
    { path: "/:rest(.*)*", component: page("NotFound"), meta: { title: "Page not found" } },
  ],
});

// A convenience only: the API checks the role on every call.
router.beforeEach((to) => {
  document.documentElement.classList.toggle("theme-console", to.path.startsWith("/app"));
  const roles = to.meta.roles;
  if (!roles) return;
  const role = session.current?.role;
  if (!role) return { path: "/sign-in", query: { next: to.fullPath } };
  if (!roles.includes(role)) return homeFor(role);
});
router.afterEach((to) => {
  const title = to.meta.title ?? "Legitify";
  document.title = title === "Legitify" ? title : `${title} | Legitify`;
});
