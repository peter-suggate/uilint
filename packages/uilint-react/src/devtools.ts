/**
 * Web-component entrypoint.
 *
 * Importing this file registers the <uilint-devtools> custom element.
 * The element mounts the React devtool UI into a .dev-tool-root container.
 */

import { defineUILintDevtoolsElement } from "./web-component";

defineUILintDevtoolsElement();
