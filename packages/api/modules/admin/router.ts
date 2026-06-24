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

export const adminRouter = {
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
