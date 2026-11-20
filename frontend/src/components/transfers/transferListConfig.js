export const TRANSFER_LIST_DEFAULT_FILTERS = {
  status: '',
  from: '',
  to: '',
  accountId: '',
  size: '20',
  sort: 'createdAt,DESC',
};

export const TRANSFER_PAGE_SIZE_OPTIONS = ['5', '10', '20', '50'];

export const TRANSFER_SORT_OPTIONS = [
  { value: 'createdAt,DESC', label: 'Fecha descendente' },
  { value: 'createdAt,ASC', label: 'Fecha ascendente' },
  { value: 'amount,DESC', label: 'Monto descendente' },
  { value: 'amount,ASC', label: 'Monto ascendente' },
  { value: 'status,ASC', label: 'Estado ascendente' },
  { value: 'status,DESC', label: 'Estado descendente' },
];
