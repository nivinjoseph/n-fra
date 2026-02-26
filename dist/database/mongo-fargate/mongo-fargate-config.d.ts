import { AppConfig } from "../../app/app-config.js";
export interface MongoFargateConfig extends AppConfig {
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
    username: string;
    password: string;
    useNlb?: boolean;
}
//# sourceMappingURL=mongo-fargate-config.d.ts.map