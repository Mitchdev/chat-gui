export interface UserMenuRawSection {
  name: string;
  flairs: string[];
  force?: boolean;
}

export interface UserMenuSection {
  data: UserMenuRawSection;
  searchcount: number;
  container: HTMLElement;
  title: HTMLElement;
  users: HTMLElement;
}
