import type { FC } from 'react';
import { AuctionDashboardApp } from './components/AuctionDashboardApp';

const DashboardPage: FC = () => {
  return (
    <>
      <style>
        {`
          html,
          body,
          #root {
            background: #f8fafc !important;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          * {
            box-sizing: border-box;
          }
        `}
      </style>
      <AuctionDashboardApp />
    </>
  );
};

export default DashboardPage;
