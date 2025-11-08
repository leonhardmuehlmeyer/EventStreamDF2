export const fileTypes = ['ocptFile', 'ocelFile'] as const;
export type FileType = (typeof fileTypes)[number];

export const otherTypes = ['ocptAsset', 'ocelAsset', 'objectEventGraph'] as const;
export type OtherType = (typeof otherTypes)[number];

export const assetTypes = [...fileTypes, ...otherTypes] as const;
export type AssetType = (typeof assetTypes)[number];
export interface ExtendedFile extends File {
    id: string;
    fileType: FileType;
}
