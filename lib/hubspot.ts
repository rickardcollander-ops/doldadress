import { Client } from '@hubspot/api-client';

export interface HubSpotConfig {
  accessToken: string;
}

export class HubSpotService {
  private client: Client;

  constructor(config: HubSpotConfig) {
    this.client = new Client({ accessToken: config.accessToken });
  }

  async createNote(contactId: string, noteContent: string, timestamp?: Date) {
    try {
      const engagement = await this.client.crm.engagements.notesApi.create({
        properties: {
          hs_timestamp: timestamp?.toISOString() || new Date().toISOString(),
          hs_note_body: noteContent,
        },
        associations: [
          {
            to: { id: contactId },
            types: [
              {
                associationCategory: 'HUBSPOT_DEFINED',
                associationTypeId: 202, // Note to Contact association
              },
            ],
          },
        ],
      });
      return engagement;
    } catch (error) {
      console.error('Error creating note in HubSpot:', error);
      throw error;
    }
  }

  async createEmail(contactId: string, emailData: {
    subject: string;
    body: string;
    from: string;
    to: string;
    timestamp?: Date;
  }) {
    try {
      const engagement = await this.client.crm.engagements.emailsApi.create({
        properties: {
          hs_timestamp: emailData.timestamp?.toISOString() || new Date().toISOString(),
          hs_email_subject: emailData.subject,
          hs_email_text: emailData.body,
          hs_email_from_email: emailData.from,
          hs_email_to_email: emailData.to,
        },
        associations: [
          {
            to: { id: contactId },
            types: [
              {
                associationCategory: 'HUBSPOT_DEFINED',
                associationTypeId: 198, // Email to Contact association
              },
            ],
          },
        ],
      });
      return engagement;
    } catch (error) {
      console.error('Error creating email in HubSpot:', error);
      throw error;
    }
  }

  async getAttachments(engagementId: string) {
    try {
      const attachments = await this.client.apiRequest({
        method: 'GET',
        path: `/engagements/v1/engagements/${engagementId}/attachments`,
      });
      return attachments;
    } catch (error) {
      console.error('Error fetching attachments from HubSpot:', error);
      throw error;
    }
  }

  async downloadAttachment(attachmentId: string) {
    try {
      const attachment = await this.client.apiRequest({
        method: 'GET',
        path: `/filemanager/api/v3/files/${attachmentId}`,
      });
      return attachment;
    } catch (error) {
      console.error('Error downloading attachment from HubSpot:', error);
      throw error;
    }
  }

  async getContactEngagements(contactId: string, engagementType?: 'NOTE' | 'EMAIL') {
    try {
      const engagements = await this.client.apiRequest({
        method: 'GET',
        path: `/crm/v3/objects/contacts/${contactId}/associations/engagements`,
      });
      return engagements;
    } catch (error) {
      console.error('Error fetching contact engagements:', error);
      throw error;
    }
  }

  async searchFiles(query: string) {
    try {
      const files = await this.client.files.filesApi.search({
        filters: [
          {
            propertyName: 'name',
            operator: 'CONTAINS_TOKEN',
            value: query,
          },
        ],
      });
      return files;
    } catch (error) {
      console.error('Error searching files in HubSpot:', error);
      throw error;
    }
  }
}

export function getHubSpotClient(): HubSpotService {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
  
  if (!accessToken) {
    throw new Error('HUBSPOT_ACCESS_TOKEN is not configured');
  }

  return new HubSpotService({ accessToken });
}
