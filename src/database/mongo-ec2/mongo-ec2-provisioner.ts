// import { given } from "@nivinjoseph/n-defensive";
// import { ServiceAppProvisioner } from "../../app/service/service-app-provisioner.js";
// import { MongoEc2Config, MongodbVersion } from "./mongo-ec2-config.js";
// import * as Fs from "node:fs";
// import * as Path from "node:path";
// import * as Pulumi from "@pulumi/pulumi";
// import { MongoEc2Details } from "./mongo-ec2-details.js";


// export class MongoEc2Provisioner extends ServiceAppProvisioner
// {
//     public constructor(name: string, config: MongoEc2Config)
//     {
//         given(config, "config").ensureHasValue().ensureIsObject().ensureHasStructure({
//             "mongoDbVersion?": "string",
//             "mongoUsername?": "string",
//             "mongoPassword?": "string"
//         });
        
//         config.mongoDbVersion ??= MongodbVersion.mongodb5_0;
//         config.mongoUsername ??= "stmongouser";
//         config.mongoPassword ??= "FlyingSquirrelMonkey";
        
//         const mongoPort = 27017;
        
//         if (config.datadogConfig != null)
//         {
//             config.datadogConfig.additionalInstrumentationLabels = {
//                 "com.datadoghq.ad.check_names": `["mongo"]`,
//                 "com.datadoghq.ad.init_configs": "[{}]",
//                 "com.datadoghq.ad.instances": `[{"hosts": ["%%host%%:${mongoPort}"], "username": "${config.mongoUsername}", "password": "${config.mongoPassword}", "database": "admin"}]`
//             };
            
//             config.datadogConfig.containerMountPoints = [
//                 { sourceVolume: "DD_full_access_mongodb", containerPath: "/mongodb" }
//             ];
//         }
        
//         super(name, {
//             vpcDetails: config.vpcDetails,
//             subnetNamePrefix: config.subnetNamePrefix,
//             ingressSubnetNamePrefixes: config.ingressSubnetNamePrefixes,
//             datadogConfig: config.datadogConfig,
//             port: mongoPort,
//             clusterConfig: {
//                 enableContainerInsights: true
//             },
//             computeProfile: config.computeProfile,
//             volumeSize: config.volumeSize,
//             image: `public.ecr.aws/docker/library/mongo:${config.mongoDbVersion}`,
//             useDockerfileCommandOrEntryPoint: true,
//             taskVolumes: [
//                 { name: "mongo-tmp-vol" },
//                 {
//                     name: "mongo-vol",
//                     hostPath: "/mongodb/data/db"
//                 },
//                 {
//                     name: "DD_full_access_mongodb",
//                     hostPath: "/mongodb"
//                 }
//             ],
//             containerMountPoints: [
//                 {
//                     sourceVolume: "mongo-vol",
//                     containerPath: "/data/db"
//                 },
//                 {
//                     sourceVolume: "mongo-tmp-vol",
//                     containerPath: "/tmp"
//                 }
//             ],
//             envVars: [
//                 { name: "TZ", value: "UTC" },
//                 { name: "MONGO_INITDB_ROOT_USERNAME", value: config.mongoUsername },
//                 { name: "MONGO_INITDB_ROOT_PASSWORD", value: config.mongoPassword }
//             ],
//             userDataFunc: (context) =>
//             {
//                 return Pulumi.all([context.clusterName, context.ebsVolumeId])
//                     .apply(([clusterName, ebsVolumeId]) =>
//                     {
//                         return Fs
//                             .readFileSync(Path.resolve(
//                                 import.meta.dirname, "mongo-ec2-user-data-template.sh"), "utf8")
//                             .replaceAll("#{mongoClusterName}", clusterName)
//                             .replaceAll("#{ebsVolumeId}", ebsVolumeId);
//                     });
//             },
//             version: config.mongoDbVersion
//         });
//     }
    
    
//     public override async provision(): Promise<MongoEc2Details>
//     {
//         const result = await super.provision();
        
//         const config = this.config as MongoEc2Config;
        
//         return {
//             ...result,
//             username: config.mongoUsername!,
//             password: config.mongoPassword!
//         };
//     }
// }