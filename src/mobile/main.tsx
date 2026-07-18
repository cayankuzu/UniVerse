import "./app/app-shell/bootstrap/appBootstrap.entry";
import App from "./app/App";
import { initializeCrashReporter, wrapRootComponent } from "./app/platform/observability/sentry";

initializeCrashReporter();

export default wrapRootComponent(App);
