import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing-config";

export { routing };

export const {
	Link: LocaleLink,
	redirect: localeRedirect,
	usePathname: useLocalePathname,
	useRouter: useLocaleRouter,
} = createNavigation(routing);
