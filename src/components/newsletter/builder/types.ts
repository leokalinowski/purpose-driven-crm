export type BlockType =
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'divider'
  | 'spacer'
  | 'columns'
  
  | 'listings'
  | 'agent_bio'
  | 'social_icons'
  | 'html_raw';

export interface HeadingProps {
  text: string;
  level: 1 | 2 | 3 | 4;
  align: 'left' | 'center' | 'right';
  color: string;
  fontFamily: string;
}

export interface TextProps {
  html: string;
  align: 'left' | 'center' | 'right';
  color: string;
  fontSize: number;
}

export interface ImageProps {
  src: string;
  alt: string;
  width: string;
  align: 'left' | 'center' | 'right';
  linkUrl: string;
  borderRadius: number;
}

export interface ButtonProps {
  text: string;
  url: string;
  backgroundColor: string;
  textColor: string;
  align: 'left' | 'center' | 'right';
  borderRadius: number;
  fullWidth: boolean;
}

export interface DividerProps {
  color: string;
  thickness: number;
  style: 'solid' | 'dashed' | 'dotted';
  width: string;
}

export interface SpacerProps {
  height: number;
}

export interface ColumnsProps {
  columns: 2 | 3;
  gap: number;
}




export interface ListingItem {
  id: string;
  url: string;
  image_url: string;
  price: string;
  address: string;
  city: string;
  beds: number;
  baths: number;
  sqft: string;
  status: 'pending' | 'loaded' | 'error';
}

export interface ListingsProps {
  style: 'grid' | 'list';
  listings: ListingItem[];
}

export interface AgentBioProps {
  layout: 'horizontal' | 'vertical';
  showHeadshot: boolean;
  showLogo: boolean;
  showPhone: boolean;
  showEmail: boolean;
}

export interface SocialIconsProps {
  align: 'left' | 'center' | 'right';
  iconSize: number;
  links: { platform: string; url: string }[];
}

export interface HtmlRawProps {
  html: string;
}

export type BlockProps =
  | HeadingProps
  | TextProps
  | ImageProps
  | ButtonProps
  | DividerProps
  | SpacerProps
  | ColumnsProps
  
  | ListingsProps
  | AgentBioProps
  | SocialIconsProps
  | HtmlRawProps;

export interface NewsletterBlock {
  id: string;
  type: BlockType;
  props: Record<string, any>;
  children?: NewsletterBlock[][];
}

export interface GlobalStyles {
  backgroundColor: string;
  contentWidth: number;
  fontFamily: string;
  bodyColor: string;
}

export const DEFAULT_GLOBAL_STYLES: GlobalStyles = {
  backgroundColor: '#f4f4f5',
  contentWidth: 600,
  fontFamily: 'Georgia, serif',
  bodyColor: '#1a1a1a',
};

export const BLOCK_DEFAULTS: Record<BlockType, Record<string, any>> = {
  heading: { text: 'Your Heading', level: 2, align: 'center', color: '#1a1a1a', fontFamily: 'Georgia, serif' },
  text: { html: '<p>Write your content here...</p>', align: 'left', color: '#374151', fontSize: 16 },
  image: { src: '', alt: 'Image', width: '100%', align: 'center', linkUrl: '', borderRadius: 0 },
  button: { text: 'Click Here', url: '#', backgroundColor: '#2563eb', textColor: '#ffffff', align: 'center', borderRadius: 6, fullWidth: false },
  divider: { color: '#e5e7eb', thickness: 1, style: 'solid', width: '100%' },
  spacer: { height: 24 },
  columns: { columns: 2, gap: 16 },
  
  listings: { style: 'grid', listings: [] },
  agent_bio: { layout: 'horizontal', showHeadshot: true, showLogo: true, showPhone: true, showEmail: true },
  social_icons: { align: 'center', iconSize: 32, links: [] },
  html_raw: { html: '' },
};
