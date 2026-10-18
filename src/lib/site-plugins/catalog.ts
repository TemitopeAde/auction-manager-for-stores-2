export interface SitePluginPlacementStatusItem {
  pluginId: string;
  placedInSlot: boolean;
}

export interface SitePluginPlacementStatusResult {
  placementStatuses: SitePluginPlacementStatusItem[];
  error?: string;
}

export interface SitePluginDefinition {
  id: string;
  name: string;
  placement: {
    appDefinitionId: string;
    widgetId: string;
    slotId: string;
  };
}

// The legacy site plugins (product page, category, gallery) haven't been ported
// to this project yet. Add their definitions here as each one is migrated.
export const SITE_PLUGIN_DEFINITIONS: SitePluginDefinition[] = [];

export const PRODUCT_PAGE_PLUGIN_IDS = new Set<string>();
