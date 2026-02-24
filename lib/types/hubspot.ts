export interface Note {
  content: string;
  timestamp?: string;
}

export interface Email {
  subject: string;
  body: string;
  from: string;
  to: string;
  timestamp?: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  size?: number;
  type?: string;
}

export interface SyncNotesRequest {
  contactId: string;
  notes: Note[];
}

export interface SyncEmailsRequest {
  contactId: string;
  emails: Email[];
}

export interface SyncResponse {
  success: boolean;
  synced: number;
  results: Array<{
    id: string;
    createdAt: string;
    success: boolean;
  }>;
}

export interface AttachmentsResponse {
  success: boolean;
  count: number;
  attachments: Attachment[];
}

export interface DownloadAttachmentRequest {
  attachmentId: string;
}

export interface DownloadAttachmentResponse {
  success: boolean;
  attachment: Attachment;
}
