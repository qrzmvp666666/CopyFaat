import { findOrganization } from "./procedures/find-organization";
import { listOrganizations } from "./procedures/list-organizations";
import { listUsers } from "./procedures/list-users";
import {
	createBatch,
	exportBatch,
	exportCodes,
	listBatches,
	listCodes,
	stats,
} from "./procedures/redeem-codes";
import { listSourceBindings, saveSourceBinding } from "./procedures/signal-source-bindings";
import { listWebhookLogs, findWebhookLog } from "./procedures/signal-webhook-logs";

export const adminRouter = {
	sourceBindings: { list: listSourceBindings, save: saveSourceBinding },
	webhookLogs: { list: listWebhookLogs, find: findWebhookLog },
	users: {
		list: listUsers,
	},
	organizations: {
		list: listOrganizations,
		find: findOrganization,
	},
	redeemCodes: {
		createBatch,
		listBatches,
		listCodes,
		stats,
		exportBatch,
		exportCodes,
	},
};
