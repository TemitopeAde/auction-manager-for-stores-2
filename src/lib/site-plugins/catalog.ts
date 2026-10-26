export interface SitePluginPlacementStatusItem {
  pluginId: string;
  placedInSlot: boolean;
  name?: string;
}

export interface SitePluginPlacementStatusResult {
  placementStatuses: SitePluginPlacementStatusItem[];
  error?: string;
}

export interface SitePluginDefinition {
  id: string;
  name: string;
  slotId?: string;
  placement?: {
    appDefinitionId: string;
    widgetId: string;
    slotId: string;
  };
}

export const SITE_PLUGIN_DEFINITIONS: SitePluginDefinition[] = [
  {
    id: 'cdaa823e-6e42-42b7-875b-f943bb44d748',
    name: 'Auction Product Page (Classic)',
    slotId: 'product-page-details-2',
    placement: {
      appDefinitionId: '1380b703-ce81-ff05-f115-39571d94dfcd',
      widgetId: '13a94f09-2766-3c40-4a32-8edb5acdd8bc',
      slotId: 'product-page-details-2',
    },
  },
  {
    id: 'ec477248-6c8a-4af6-8e7d-9f7572646214',
    name: 'Auction Product Page (Modern)',
    slotId: 'product-page-details-3',
    placement: {
      appDefinitionId: 'a0c68605-c2e7-4c8d-9ea1-767f9770e087',
      widgetId: '6a25b678-53ec-4b37-a190-65fcd1ca1a63',
      slotId: 'product-page-details-3',
    },
  },
  {
    id: 'f4deb061-e301-4e51-a79b-502e82acc9fd',
    name: 'Auction Product Gallery Top',
    slotId: 'product-gallery-top',
    placement: {
      appDefinitionId: '1380b703-ce81-ff05-f115-39571d94dfcd',
      widgetId: '13afb094-84f9-739f-44fd-78d036adb028',
      slotId: 'product-gallery-top',
    },
  },
  {
    id: 'e03143e5-1611-487b-8f37-77cd72731185',
    name: 'Category Auction Cards',
    slotId: 'gallery-products-top',
    placement: {
      appDefinitionId: '1380b703-ce81-ff05-f115-39571d94dfcd',
      widgetId: 'bda15dc1-816d-4ff3-8dcb-1172d5343cce',
      slotId: 'gallery-products-top',
    },
  },
];

export const PRODUCT_PAGE_PLUGIN_IDS = new Set<string>([
  'cdaa823e-6e42-42b7-875b-f943bb44d748',
  'ec477248-6c8a-4af6-8e7d-9f7572646214',
]);
