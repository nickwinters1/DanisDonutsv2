/* Shapes shared with supabase/setup.sql + supabase/upgrade.sql. Keep them in sync. */

export type Category = 'note' | 'memory' | 'clip' | 'card' | 'letter' | 'capsule';
export type Visibility = 'public' | 'private';
export type Status = 'pending' | 'approved' | 'rejected';

/* The allowed values below are enforced by the `island_meta_valid` check in upgrade.sql. */
export type Frosting = 'strawberry' | 'blueberry' | 'chocolate' | 'vanilla' | 'ocean' | 'rainbow';
export type SprinkleStyle = 'rainbow' | 'stars' | 'hearts' | 'plain';
export type Region = 'na' | 'sa' | 'eu' | 'af' | 'as' | 'oc';
export type Gem = 'amethyst' | 'rose' | 'aqua' | 'citrine' | 'emerald';
export type CardStyle = 'gaming' | 'friendship' | 'donut' | 'crystal' | 'beach' | 'collector';

export interface Meta {
  frosting?: Frosting;
  sprinkles?: SprinkleStyle;
  region?: Region;
  crystal?: Gem;
  cardStyle?: CardStyle;
}

export interface Message {
  id: string;
  event_id: string;
  category: Category;
  author: string;
  title: string;
  body: string;
  link: string | null;
  visibility: Visibility;
  status: Status;
  created_at?: string;
  meta?: Meta | null;
  /** Labeled sample content (Preview Mode only). Never stored in the database. */
  example?: boolean;
}

export interface NewMessage {
  meta: Meta;
  event_id: string;
  category: Category;
  author: string;
  title: string;
  body: string;
  link: string | null;
  visibility: Visibility;
}

export interface IslandEvent {
  id: string;
  title: string;
  revealed: boolean;
  finale_token?: string;
}

export interface Archive {
  id: string;
  title: string;
  published_at?: string;
}

export interface Session {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}
