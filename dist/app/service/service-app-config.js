export var ServiceAppComputeProfile;
(function (ServiceAppComputeProfile) {
    /**
     * @description cpu 2, memory 4
     */
    ServiceAppComputeProfile[ServiceAppComputeProfile["large"] = 4] = "large";
    /**
     * @description cpu 4, memory 8
     */
    ServiceAppComputeProfile[ServiceAppComputeProfile["xlarge"] = 5] = "xlarge";
    /**
     * @description cpu 8, memory 16
     */
    ServiceAppComputeProfile[ServiceAppComputeProfile["xxlarge"] = 6] = "xxlarge";
    /**
     * @description cpu 16, memory 32
     */
    ServiceAppComputeProfile[ServiceAppComputeProfile["xxxlarge"] = 7] = "xxxlarge";
})(ServiceAppComputeProfile || (ServiceAppComputeProfile = {}));
//# sourceMappingURL=service-app-config.js.map