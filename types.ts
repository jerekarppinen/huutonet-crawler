export interface RuntimeConfig {
    START_PAGE_URL: string;
    ENABLE_DELAY_BETWEEN_ACTIONS: boolean;
    MAX_PAGES_TO_CRAWL: number;
    START_PAGE_NUMBER: number;
    MIN_PRICE: number;
    MAX_PRICE: number;
    MAX_DATE: string;
}

export interface ItemLink {
    href: string;
    price: number;
    publishedDate: string;
}
  
export interface SoldDeal {
    title: string;
    closedDate?: string;
    price?: string;
}
  
export interface ProgressTracker {
    lastCheckedIndex: number;
    soldDeals: SoldDeal[];
}