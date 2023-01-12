export interface Aspv2Config {
    subnetNamePrefix: string;
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
    databaseName: string;
    minCapacity: number;
    maxCapacity: number;
    deletionProtection: boolean;
    skipFinalSnapshot: boolean;
}
