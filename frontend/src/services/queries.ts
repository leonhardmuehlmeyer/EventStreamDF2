import { useQuery } from '@tanstack/react-query';
import { getOcpt } from '~/services/api';
import { getOcel } from '~/services/api';

export const useGetOcpt = (fileId: string | null) => {
    return useQuery({
        queryKey: ['getOcpt', fileId],
        queryFn: () => getOcpt(fileId!),
        refetchOnWindowFocus: false,
        enabled: Boolean(fileId),
    });
};

export const useGetOcel = (fileId: string | null) => {
    return useQuery({
        queryKey: ['getOcel', fileId],
        queryFn: () => getOcel(fileId!),
        refetchOnWindowFocus: false,
        enabled: Boolean(fileId),
    });
};

