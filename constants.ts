
import { ColumnType, Column, AppUser } from './types';

export const INITIAL_COLUMNS: Column[] = [
  { id: 'name', title: 'Name', type: ColumnType.TEXT, width: 220 },
  { id: 'dob', title: 'DOB', type: ColumnType.DATE, width: 130 },
  { id: 'phone', title: 'Phone Number', type: ColumnType.TEXT, width: 150 },
  {
    id: 'crmStatus', // Aligned with DB crm_status
    title: 'Status / Level',
    type: ColumnType.DROPDOWN,
    options: ['No Contact', 'Screening Completed', 'EA Completed', 'Approval Pending', 'Approved', 'Services Rendered'],
    width: 180
  },
  {
    id: 'qualifiedFor',
    title: 'Qualified For',
    type: ColumnType.MULTI_SELECT,
    options: ['MTM', 'Cooking Ware x3', 'Transportation', 'Housing', 'Utilities'],
    width: 250
  },
  {
    id: 'approved',
    title: 'Approved',
    type: ColumnType.DROPDOWN,
    options: ['Pending', 'Yes', 'No'],
    width: 120
  },
  { id: 'assignedTo', title: 'Assigned Navigator', type: ColumnType.DROPDOWN, width: 180 },
  { id: 'city', title: 'City', type: ColumnType.TEXT, width: 150 },
  { id: 'householdSize', title: 'Household Size', type: ColumnType.NUMBER, width: 120 },
  { id: 'address', title: 'Address', type: ColumnType.TEXT, width: 250 },
  { id: 'dateOutreached', title: 'Date Outreached', type: ColumnType.DATE, width: 150 },
  { id: 'dateScreened', title: 'Date Screened', type: ColumnType.DATE, width: 150 },
  { id: 'householdMembers', title: 'Household Members', type: ColumnType.TEXT, width: 300 },
  { id: 'interactionLogs', title: 'Call Logs & Notes', type: ColumnType.TEXT, width: 350 },
];

export const MOCK_USERS: AppUser[] = [];

export const INITIAL_DATA: any[] = [];
