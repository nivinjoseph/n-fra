// import { ensureExhaustiveCheck, given } from "@nivinjoseph/n-defensive";
// import * as Pulumi from "@pulumi/pulumi";
// import { EnvType } from "../common/env-type.js";
// import { VpcDetails } from "../vpc/vpc-details.js";
// import { AppDatadogConfig } from "./app-config.js";
// import { Secret } from "../secret/secret.js";
// import { AppClusterDetails } from "./app-cluster-details.js";
// import { AlbProvisioner } from "../ingress/alb/alb-provisioner.js";
// import { AppComputeProfile } from "./app-compute-profile.js";
// import { Logger } from "../common/logger.js";
// import { WorkerAppProvisioner } from "./worker/worker-app-provisioner.js";
// import { GrpcAppProvisioner } from "./grpc/grpc-app-provisioner.js";
// import { HttpAppProvisioner } from "./http/http-app-provisioner.js";
// import { AppProvisioner } from "./app-provisioner.js";
// import { EnvVar } from "../index.js";


// export type App = {
//     cluster: string;
//     name: string;
//     image: string;
//     tag: string;
//     command: string; // command vs entrypoint
//     compute: "xsmall" | "small" | "medium" | "large" | "xlarge" | "xxlarge" | "xxxlarge";
//     env: Object;
//     autoScale: boolean;
// };

// export type WorkerApp = App;

// export type GrpcApp = WorkerApp & {
//     healthCheck: string;
// };

// export type HttpApp = GrpcApp & {
//     public: boolean;
//     host?: string;
//     certificateArn?: string; 
// };

// export type AppDefinition = App & WorkerApp & GrpcApp & HttpApp & {
//     type: "worker" | "grpc" | "http";
    
//     // healthCheck?: string;
//     // public?: boolean;
//     // host?: string;
//     // certificateArn?: string;
// };

// // export type App = WorkerApp | GrpcApp | HttpApp;

// export function createWorkerAppDefinition(config: WorkerApp): AppDefinition
// {
//     return {
//         type: "worker",
//         cluster: config.cluster,
//         name: config.name,
//         image: config.image,
//         tag: config.tag,
//         command: config.command,
//         compute: config.compute,
//         env: config.env,
//         autoScale: config.autoScale,
//         healthCheck: "/healthcheck",
//         public: false
//     };
// }

// export function createGrpcAppDefinition(config: GrpcApp): AppDefinition
// {
//     return {
//         type: "grpc",
//         cluster: config.cluster,
//         name: config.name,
//         image: config.image,
//         tag: config.tag,
//         command: config.command,
//         compute: config.compute,
//         env: config.env,
//         autoScale: config.autoScale,
//         healthCheck: config.healthCheck,
//         public: false
//     };
// }

// export function createHttpAppDefinition(config: HttpApp): AppDefinition
// {
//     return {
//         type: "http",
//         cluster: config.cluster,
//         name: config.name,
//         image: config.image,
//         tag: config.tag,
//         command: config.command,
//         compute: config.compute,
//         env: config.env,
//         autoScale: config.autoScale,
//         healthCheck: config.healthCheck,
//         public: config.public,
//         host: config.host,
//         certificateArn: config.certificateArn
//     };
// }

// // export const apps: Array<WorkerApp | GrpcApp | HttpApp>  = [
// //     {
// //         cluster: "test",
// //         type: "worker",
        
        
// //     }
// // ];


// export class AppsFactory
// {
//     private readonly _env: EnvType;
//     private readonly _vpcDetails: VpcDetails;
//     private readonly _datadogConfig: AppDatadogConfig;
//     private readonly _envValues: Map<string, Pulumi.Output<string>>;
//     private readonly _envSecrets: ReadonlyArray<Secret>;
//     private readonly _apps: ReadonlyArray<AppDefinition>;
//     // private readonly _appsDependencies = new Map<string, Array<string>>();
//     private readonly _albTargetGroups = new Map<string, Pulumi.Output<string>>();
//     private readonly _clusters = new Map<string, AppClusterDetails>();
//     private readonly _appOutputs = new Map<string, string>();
//     private readonly _provisionedApps = new Set<string>();
//     // private readonly _mutex = new Mutex();
    
    
//     private get _privateSubnetNamePrefix(): string { return `${this._env}-private`; }
    
//     private get _publicSubnetNamePrefix(): string { return `${this._env}-public`; }
    
    
//     public constructor(env: EnvType, vpcDetails: VpcDetails, datadogConfig: AppDatadogConfig,
//         envValues: ReadonlyMap<string, Pulumi.Output<string>>, envSecrets: ReadonlyArray<Secret>,
//         apps: ReadonlyArray<AppDefinition>)
//     {
//         given(env, "env").ensureHasValue().ensureIsEnum(EnvType);
//         this._env = env;
        
//         given(vpcDetails, "vpcDetails").ensureHasValue().ensureIsObject();
//         this._vpcDetails = vpcDetails;
        
//         given(datadogConfig, "datadogConfig").ensureHasValue().ensureIsObject();
//         this._datadogConfig = datadogConfig;
        
//         given(envValues, "envValues").ensureHasValue().ensureIsObject();
//         this._envValues = new Map<string, Pulumi.Output<string>>(envValues);
        
//         given(envSecrets, "envSecrets").ensureHasValue().ensureIsArray();
//         this._envSecrets = envSecrets;
        
//         given(apps, "apps").ensureHasValue().ensureIsArray()
//             .ensure(t => t.distinct(u => u.name).length === t.length,
//                 "app names must be unique");
//         this._apps = apps;
//     }
    
    
//     public async provisionApps(): Promise<void>
//     {
//         this._provisionAlbs();
        
//         // next we need to identify cross app dependencies? env vars?
//         // only dependencies are urls
        
//         // grpc and http apps go first
        
//         // worker apps go last because nobody can depend on them

        
//         // ignoring the above dependency rules
        
//         for (const app of this._apps)
//         {
//             await this._provisionApp(app);
//         }
//     }
    
//     private _provisionAlbs(): void
//     {
//         // first we need to deploy required loadbalancers and resolve target groups

//         const albApps = this._apps.where(t => t.type === "http" && t.host != null);
//         const defaultHostApps = albApps.where(t => t.host === "default");
//         const otherHostApps = albApps.where(t => t.host !== "default");
//         // we have grouped by parent domain
//         const groupedApps = otherHostApps.groupBy(t => t.host!.split(".").skip(1).join("."));

//         // 1 alb per default host app

//         // 1 alb per group

//         for (const app of defaultHostApps)
//         {
//             const albName = `${app.name}-lb`;
//             const albProvisioner = new AlbProvisioner(albName, {
//                 vpcDetails: this._vpcDetails,
//                 subnetNamePrefix: this._publicSubnetNamePrefix,
//                 egressSubnetNamePrefixes: [this._privateSubnetNamePrefix],
//                 targets: [{ host: "default", healthCheckPath: app.healthCheck }],
//                 certificateArn: app.certificateArn
//             });
//             const albDetails = albProvisioner.provision();
//             this._albTargetGroups.set(app.name, albDetails.hostTargets["default"].albTargetGroupArn);
//         }

//         groupedApps.forEach((group, index) =>
//         {
//             const albName = `group${index}-lb`;
//             const albProvisioner = new AlbProvisioner(albName, {
//                 vpcDetails: this._vpcDetails,
//                 subnetNamePrefix: this._publicSubnetNamePrefix,
//                 egressSubnetNamePrefixes: [this._privateSubnetNamePrefix],
//                 targets: group.values.map(t => ({
//                     host: t.host!,
//                     healthCheckPath: t.healthCheck
//                 })),
//                 certificateArn: group.values
//                     .where(t => t.certificateArn != null)[0]?.certificateArn
//             });
//             const albDetails = albProvisioner.provision();

//             group.values.forEach(t =>
//                 this._albTargetGroups.set(t.name, albDetails.hostTargets[t.host!].albTargetGroupArn)
//             );
//         });
//     }
    
//     // private _resolveAppDependencies(): void
//     // {
//     //     const apps =
        
//     //     const allDependencyKeys = this._apps
//     //         .where(t => t.type === "grpc" || t.type === "http")
//     //         .map(t => [this._createHostKey(t), this._createPortKey(t)])
//     //         .reduce((acc, t) =>
//     //         {
//     //             acc.push(...t);
//     //             return acc;
//     //         }, new Array<string>());
        
        
//     //     // we want to identify self dependencies
//     //     // we want to identify circular dependencies
//     //     for (const app of this._apps)
//     //     {
            
            
//     //     }
//     // }
    
//     private async _provisionApp(app: AppDefinition): Promise<void>
//     {
//         try
//         {
//             if (this._provisionedApps.has(app.name))
//                 return;

//             const { type } = app;

//             const image = `${app.image}:${app.tag}`;
//             const command = app.command.split(" ");
//             const computeProfile = AppComputeProfile[app.compute];

//             const { envVars, secrets, unresolved } = this._resolveEnvVarsAndSecrets(app.env);

//             if (unresolved != null && unresolved.isNotEmpty)
//             {
//                 const message = `The following env values for app ${app.name} could not be resolved => [${unresolved.join(", ")}]`;
//                 await Logger.logWarning(message);
//             }

//             const minCapacity = 1;
//             const maxCapacity = app.autoScale ? 5 : 1;

//             switch (type)
//             {
//                 case "worker":
//                     {
//                         const provisioner = new WorkerAppProvisioner(app.name, {
//                             image,
//                             command,
//                             computeProfile,
//                             subnetNamePrefix: this._privateSubnetNamePrefix,
//                             vpcDetails: this._vpcDetails,
//                             datadogConfig: this._datadogConfig,
//                             cluster: this._resolveCluster(app.cluster),
//                             envVars,
//                             secrets,
//                             minCapacity,
//                             maxCapacity
//                         });
//                         const _details = await provisioner.provision();
//                         break;
//                     }
//                 case "grpc":
//                     {
//                         const provisioner = new GrpcAppProvisioner(app.name, {
//                             image,
//                             command,
//                             computeProfile,
//                             subnetNamePrefix: this._privateSubnetNamePrefix,
//                             vpcDetails: this._vpcDetails,
//                             datadogConfig: this._datadogConfig,
//                             cluster: this._resolveCluster(app.cluster),
//                             envVars,
//                             secrets,
//                             minCapacity,
//                             maxCapacity,
//                             healthCheckPath: app.healthCheck,
//                             ingressSubnetNamePrefixes: [this._privateSubnetNamePrefix]
//                         });
//                         const details = await provisioner.provision();
//                         const hostKey = this._createHostKey(app);
//                         const portKey = this._createPortKey(app);
//                         this._appOutputs.set(hostKey, details.host);
//                         this._appOutputs.set(portKey, details.port.toString());
//                         this._envValues.set(hostKey, Pulumi.output(details.host));
//                         this._envValues.set(portKey, Pulumi.output(details.port.toString()));
//                         break;
//                     }
//                 case "http":
//                     {
//                         const provisioner = new HttpAppProvisioner(app.name, {
//                             image,
//                             command,
//                             computeProfile,
//                             subnetNamePrefix: this._privateSubnetNamePrefix,
//                             vpcDetails: this._vpcDetails,
//                             datadogConfig: this._datadogConfig,
//                             cluster: this._resolveCluster(app.cluster),
//                             envVars,
//                             secrets,
//                             minCapacity,
//                             maxCapacity,
//                             healthCheckPath: app.healthCheck,
//                             ingressSubnetNamePrefixes: [this._privateSubnetNamePrefix, ...app.public ? [this._publicSubnetNamePrefix] : []],
//                             albTargetGroupArn: app.host != null ? this._albTargetGroups.get(app.name) : undefined
//                         });
//                         const details = await provisioner.provision();
//                         this._appOutputs.set(`${app.name}__HOST`, details.host);
//                         this._appOutputs.set(`${app.name}__PORT`, details.port.toString());
//                         this._envValues.set(`${app.name}__HOST`, Pulumi.output(details.host));
//                         this._envValues.set(`${app.name}__PORT`, Pulumi.output(details.port.toString()));
//                         break;
//                     }
//                 default:
//                     ensureExhaustiveCheck(type);
//             }

//             this._provisionedApps.add(app.name);
//         }
//         finally
//         {
//             // this._mutex.release();
//         }
//     }
    
//     private _resolveCluster(clusterName: string): AppClusterDetails
//     {
//         given(clusterName, "clusterName").ensureHasValue().ensureIsString();
//         clusterName = clusterName.trim();
//         const normalizedClusterName = clusterName.toLowerCase();
        
//         if (!this._clusters.has(normalizedClusterName))
//         {
//             this._clusters.set(normalizedClusterName, AppProvisioner.provisionAppCluster(clusterName, {
//                 enableContainerInsights: true
//             }));
//         }
        
//         return this._clusters.get(normalizedClusterName)!;
//     }
    
//     private _resolveEnvVarsAndSecrets(envObj: Object): { envVars?: Array<EnvVar>; secrets?: Array<Secret>; unresolved?: Array<string>; }
//     {
//         // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
//         if (envObj == null || Object.keys(envObj).isEmpty)
//             return {};
        
//         const unresolved = new Array<string>();
//         const secrets = new Array<Secret>();
//         const envVars = new Array<EnvVar>();
        
//         Object.keys(envObj).forEach(key =>
//         {
//             key = key.trim();
//             let value = (<any>envObj)[key] as string;
//             // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
//             if (value == null || typeof value !== "string")
//                 return;
//             value = value.trim();
            
//             if (value.startsWith("${{") && value.endsWith("}}"))
//             {
//                 const resolvableName = value.substring(3, value.length - 2);
                
//                 const secret = this._envSecrets.find(t => t.name === resolvableName);
//                 if (secret == null)
//                 {
//                     const envVal = this._envValues.get(resolvableName);
//                     if (envVal == null)
//                     {
//                         unresolved.push(resolvableName);
//                         return;
//                     }
//                     else
//                     {
//                         envVars.push({
//                             name: key,
//                             value: envVal
//                         });
//                     }
//                 }
//                 else
//                 {
//                     secrets.push({
//                         name: key,
//                         arn: secret.arn
//                     });
//                 }
//             }
//             else
//             {
//                 envVars.push({
//                     name: key,
//                     value: value
//                 });
//             }
//         });
        
//         const result: { envVars?: Array<EnvVar>; secrets?: Array<Secret>; unresolved?: Array<string>; } = {};
        
//         if (unresolved.isNotEmpty)
//             result.unresolved = unresolved;
        
//         if (secrets.isNotEmpty)
//             result.secrets = secrets;
        
//         if (envVars.isNotEmpty)
//             result.envVars = envVars;
        
        
//         return result;
//     }
    
//     private _createHostKey(app: AppDefinition): string
//     {
//         return `${app.name}__HOST`;
//     }
    
//     private _createPortKey(app: AppDefinition): string
//     {
//         return `${app.name}__PORT`;
//     }
// }