export interface FileResult {
  content: string;
  filePath: string;
}

export interface SaveResult {
  success: boolean;
  filePath?: string;
}

export interface PreloadApi {
  openFile: () => Promise<FileResult | null>;
  saveFile: (content: string, filePath: string) => Promise<SaveResult>;
  saveFileAs: (content: string) => Promise<SaveResult>;
  setTitle: (title: string) => void;
  onMenuOpen: (callback: () => void) => void;
  onMenuSave: (callback: () => void) => void;
}
