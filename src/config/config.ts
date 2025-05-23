import * as dotenv from "dotenv";

const ModuleName = "[config]";
export const evhNamespaceConnectionString =
  process.env["EVENTHUBCONNSTR_EVENTHUB_NAMESPACE_CONNECTION_STRING"] || "";
export const evhConnectionString =
  process.env["EVENTHUBCONNSTR_EVENTHUB_CONNECTION_STRING"] || "";
