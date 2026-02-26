import { ensureExhaustiveCheck, given } from "@nivinjoseph/n-defensive";


export enum AppComputeProfile
{
    /**
     * @description cpu 265, memory 512
     */
    xsmall = 1,

    /**
     * @description cpu  512, memory 1024
     */
    small = 2,

    /**
     * @description cpu 1024, memory 2048
     */
    medium = 3,

    /**
     * @description cpu 2048, memory 4096
     */
    large = 4,

    /**
     * @description cpu 4096, memory 8192
     */
    xlarge = 5,

    /**
     * @description cpu 8192, memory 16384
     */
    xxlarge = 6,

    /**
     * @description cpu 16384, memory 32768
     */
    xxxlarge = 7,



    /**
     * @description cpu 265, memory 2048
     */
    xsmallMemoryOptimized = 8,

    /**
     * @description cpu  512, memory 4096
     */
    smallMemoryOptimized = 9,

    /**
     * @description cpu 1024, memory 8192
     */
    mediumMemoryOptimized = 10,

    /**
     * @description cpu 2048, memory 16384
     */
    largeMemoryOptimized = 11,

    /**
     * @description cpu 4096, memory 30720
     */
    xlargeMemoryOptimized = 12,

    /**
     * @description cpu 8192, memory 61440
     */
    xxlargeMemoryOptimized = 13,

    /**
     * @description cpu 16384, memory 122880
     */
    xxxlargeMemoryOptimized = 14
}

export interface AppCompute
{
    cpu: number;
    memory: number;
}

export function resolveAppCompute(profile: AppComputeProfile): AppCompute
{
    given(profile, "profile").ensureHasValue().ensureIsEnum(AppComputeProfile);

    switch (profile) 
    {
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