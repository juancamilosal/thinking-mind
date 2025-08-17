export class AccountReceivable {
  id?: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  studentName: string;
  amount: number;
  description: string;
  dueDate: string;
  invoiceNumber: string;
  status: 'pending' | 'paid';
  createdDate: string;
}
