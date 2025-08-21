export interface AccountReceivable {
  id: string;
  clientDocumentType: string;
  clientDocumentNumber: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  studentDocumentType: string;
  studentDocumentNumber: string;
  studentName: string;
  colegio: string;
  curso: string;
  amount: number;
  description: string;
  dueDate: string;
  invoiceNumber: string;
  status: 'pending' | 'paid' | 'overdue';
  createdDate: string;
}
