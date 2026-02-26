import { ensureExhaustiveCheck, given } from "@nivinjoseph/n-defensive";
export var AppComputeProfile;
(function (AppComputeProfile) {
    /**
     * @description cpu 265, memory 512
     */
    AppComputeProfile[AppComputeProfile["xsmall"] = 1] = "xsmall";
    /**
     * @description cpu  512, memory 1024
     */
    AppComputeProfile[AppComputeProfile["small"] = 2] = "small";
    /**
     * @description cpu 1024, memory 2048
     */
    AppComputeProfile[AppComputeProfile["medium"] = 3] = "medium";
    /**
     * @description cpu 2048, memory 4096
     */
    AppComputeProfile[AppComputeProfile["large"] = 4] = "large";
    /**
     * @description cpu 4096, memory 8192
     */
    AppComputeProfile[AppComputeProfile["xlarge"] = 5] = "xlarge";
    /**
     * @description cpu 8192, memory 16384
     */
    AppComputeProfile[AppComputeProfile["xxlarge"] = 6] = "xxlarge";
    /**
     * @description cpu 16384, memory 32768
     */
    AppComputeProfile[AppComputeProfile["xxxlarge"] = 7] = "xxxlarge";
    /**
     * @description cpu 265, memory 2048
     */
    AppComputeProfile[AppComputeProfile["xsmallMemoryOptimized"] = 8] = "xsmallMemoryOptimized";
    /**
     * @description cpu  512, memory 4096
     */
    AppComputeProfile[AppComputeProfile["smallMemoryOptimized"] = 9] = "smallMemoryOptimized";
    /**
     * @description cpu 1024, memory 8192
     */
    AppComputeProfile[AppComputeProfile["mediumMemoryOptimized"] = 10] = "mediumMemoryOptimized";
    /**
     * @description cpu 2048, memory 16384
     */
    AppComputeProfile[AppComputeProfile["largeMemoryOptimized"] = 11] = "largeMemoryOptimized";
    /**
     * @description cpu 4096, memory 30720
     */
    AppComputeProfile[AppComputeProfile["xlargeMemoryOptimized"] = 12] = "xlargeMemoryOptimized";
    /**
     * @description cpu 8192, memory 61440
     */
    AppComputeProfile[AppComputeProfile["xxlargeMemoryOptimized"] = 13] = "xxlargeMemoryOptimized";
    /**
     * @description cpu 16384, memory 122880
     */
    AppComputeProfile[AppComputeProfile["xxxlargeMemoryOptimized"] = 14] = "xxxlargeMemoryOptimized";
})(AppComputeProfile || (AppComputeProfile = {}));
export function resolveAppCompute(profile) {
    given(profile, "profile").ensureHasValue().ensureIsEnum(AppComputeProfile);
    switch (profile) {
        case AppComputeProfile.xsmall:
            return { cpu: 256, memory: 512 };
        case AppComputeProfile.small:
            return { cpu: 512, memory: 1024 };
        case AppComputeProfile.medium:
            return { cpu: 1024, memory: 2048 };
        case AppComputeProfile.large:
            return { cpu: 2048, memory: 4096 };
        case AppComputeProfile.xlarge:
            return { cpu: 4096, memory: 8192 };
        case AppComputeProfile.xxlarge:
            return { cpu: 8192, memory: 16384 };
        case AppComputeProfile.xxxlarge:
            return { cpu: 16384, memory: 32768 };
        case AppComputeProfile.xsmallMemoryOptimized:
            return { cpu: 256, memory: 2048 };
        case AppComputeProfile.smallMemoryOptimized:
            return { cpu: 512, memory: 4096 };
        case AppComputeProfile.mediumMemoryOptimized:
            return { cpu: 1024, memory: 8192 };
        case AppComputeProfile.largeMemoryOptimized:
            return { cpu: 2048, memory: 16384 };
        case AppComputeProfile.xlargeMemoryOptimized:
            return { cpu: 4096, memory: 30720 };
        case AppComputeProfile.xxlargeMemoryOptimized:
            return { cpu: 8192, memory: 61440 };
        case AppComputeProfile.xxxlargeMemoryOptimized:
            return { cpu: 16384, memory: 122880 };
        default:
            ensureExhaustiveCheck(profile);
    }
}
//# sourceMappingURL=app-compute-profile.js.map