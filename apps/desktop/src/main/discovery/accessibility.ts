import koffi from "koffi";

// Chromium-based desktop apps expose their web UI after this AX attribute is enabled.
export function activateMacAccessibility(pid: number) {
	if (process.platform !== "darwin") return;
	const ax = koffi.load(
		"/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices",
	);
	const cf = koffi.load("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation");
	const createApp = ax.func("void *AXUIElementCreateApplication(int pid)");
	const setAttribute = ax.func(
		"int AXUIElementSetAttributeValue(void *element, void *attribute, void *value)",
	);
	const isSettable = ax.func(
		"int AXUIElementIsAttributeSettable(void *element, void *attribute, _Out_ bool *settable)",
	);
	const createString = cf.func(
		"void *CFStringCreateWithCString(void *allocator, str value, uint32 encoding)",
	);
	const release = cf.func("void CFRelease(void *value)");
	const enabled = koffi.decode(cf.symbol("kCFBooleanTrue"), "void *");
	const application = createApp(pid);
	if (!application) throw new Error("无法激活 Discord 无障碍界面，请检查辅助功能权限。");
	try {
		for (const name of ["AXManualAccessibility", "AXEnhancedUserInterface"]) {
			const attribute = createString(null, name, 0x08000100);
			if (!attribute) throw new Error("无法初始化 Discord 无障碍界面。");
			try {
				const settable = [false];
				if (isSettable(application, attribute, settable) === 0 && settable[0]) {
					if (setAttribute(application, attribute, enabled) !== 0)
						throw new Error("无法激活 Discord 无障碍界面，请检查辅助功能权限。");
					return;
				}
			} finally {
				release(attribute);
			}
		}
	} finally {
		release(application);
	}
}
