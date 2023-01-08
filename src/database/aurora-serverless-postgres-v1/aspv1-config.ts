export interface Aspv1Config
{
    subnetNamePrefix: string;
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
    databaseName: string;
    minCapacity: number;
    maxCapacity: number;
    autoPause: boolean;
    deletionProtection: boolean;
    skipFinalSnapshot: boolean;
}