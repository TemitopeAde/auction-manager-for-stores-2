import {
  createAuction,
  createAuctionFromProduct,
  deleteAuction,
  deleteAuctions,
  deleteBid,
  exportAuctionCsv,
  exportLeadsCsv,
  getDashboardMonitor,
  getSettings,
  getSitePluginPlacementStatus,
  getStoreProductsByIds,
  loadDashboard,
  queryStoreProducts,
  resendWinnerPaymentEmail,
  runAuctionAction,
  saveSettings,
  searchAuctionBids,
  searchDashboardAuctions,
  searchDashboardLeads,
  searchDashboardProducts,
  sendLeadEmails,
  updateAuction,
} from './auction-service';

/**
 * Admin service methods the dashboard page may call through
 * `/api/dashboard/rpc`. Only methods listed here are reachable.
 */
export const DASHBOARD_METHODS = {
  createAuction,
  createAuctionFromProduct,
  deleteAuction,
  deleteAuctions,
  deleteBid,
  exportAuctionCsv,
  exportLeadsCsv,
  getDashboardMonitor,
  getSettings,
  getSitePluginPlacementStatus,
  getStoreProductsByIds,
  loadDashboard,
  queryStoreProducts,
  resendWinnerPaymentEmail,
  runAuctionAction,
  saveSettings,
  searchAuctionBids,
  searchDashboardAuctions,
  searchDashboardLeads,
  searchDashboardProducts,
  sendLeadEmails,
  updateAuction,
};

export type DashboardMethods = typeof DASHBOARD_METHODS;
export type DashboardMethodName = keyof DashboardMethods;
