import { PriorityLabel } from './types';

export const getPriorityLabel = (priority: number): PriorityLabel => {
  switch (priority) {
    case 2:
      return { text: 'High', className: 'high' };
    case 1:
      return { text: 'Med', className: 'med' };
    default:
      return { text: 'Low', className: 'low' };
  }
};
