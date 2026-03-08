import axios, { type AxiosResponse } from 'axios';
import { GetCaseNotionsResponse } from '~/services/response.types';
import { CaseOcelResponse } from '~/types/api/ocel_collection.api';
import { CaseNotionApiResponse } from '~/types/case_notion.types';
import { ExtendedFile } from '~/types/files.types';
import { OcptSchemaApi } from '~/types/ocpt/ocpt.types';

// Import the new type

const api = axios.create({
    baseURL: import.meta.env.VITE_BACKEND_BASE_URL,
    withCredentials: false,
});

export const uploadFile = async (file: ExtendedFile) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_id', file.id);
    // formData.append('file_type', file.fileType);

    let response;
    switch (file.fileType) {
        case 'ocelFile':
            response = await api.post<any, AxiosResponse<any, any>, any>('/v1/upload/ocel', formData);
            break;
        case 'ocptFile':
            response = await api.post<any, AxiosResponse<any, any>, any>('/v1/upload/ocpt', formData);
            break;
    }

    return response.data;
};

type GetOcptResponse = {
    ocpt: OcptSchemaApi;
    file_id: string;
};
export const getOcpt = async (fileId: string): Promise<GetOcptResponse> => {
    const response = await api.get(`/v1/objects/ocpt/${fileId}`);
    return response.data;
};

export const getIdentityOcpt = async (fileId: string): Promise<GetOcptResponse> => {
    const response = await api.get(`/v1/objects/extended_ocpt/${fileId}`);
    return { file_id: response.data.file_id, ocpt: response.data.extended_ocpt };
};

export const mineIdentityOcpt = async (ocelFileId: string, baseAlgorithm: string = 'DF2'): Promise<GetOcptResponse> => {
    // Mine base OCPT
    const endpoint = baseAlgorithm.toLowerCase() === 'ocim' ? 'ocim' : 'df2';
    const baseResponse = await api.get(`v1/ocpt/${endpoint}/${ocelFileId}`);
    const baseFileId: string = baseResponse.data.file_id;
    // Extend with identity relations using the same OCEL
    const extendedResponse = await api.get(`v1/ocpt/extend/${baseFileId}?ocel_id=${ocelFileId}`);
    return { file_id: extendedResponse.data.file_id, ocpt: extendedResponse.data.extended_ocpt };
};

export const getOcel = async (fileId: string) => {
    const response = await api.get(`/v1/objects/ocel/${fileId}`);
    return response.data;
};

export const getHistogram = async (fileId: string) => {
    const response = await api.get(`/v1/event_object_frequencies/histogram/${fileId}`);
    return response.data;
};

export const setFilteredHistogram = async (fileId: string, payload: any) => {
    const response = await api.post(`/v1/event_object_frequencies/histogram_filter/${fileId}`, payload);
    return response.data;
};

export const mineCaseNotion = async (
    fileId: string,
    algorithm: string,
    objectType: string,
    newFileId: string,
    payload?: any
) => {
    let endpoint = algorithm;
    if (algorithm === 'connected-component') endpoint = 'connected_components';
    if (algorithm === 'generic') endpoint = 'generic_case_notion';

    const params = new URLSearchParams({
        case_notion_file_id: newFileId,
    });

    if (algorithm === 'generic') {
        const response = await api.post(`/v1/case_notion/${endpoint}/${fileId}?${params.toString()}`, payload);
        return response.data;
    } else {
        params.append('object_type', objectType);
        const response = await api.get(`/v1/case_notion/${endpoint}/${fileId}?${params.toString()}`);
        return response.data;
    }
};

export const saveFilteredOcel = async (payload: { fileId: string; nodes: any[]; edges: any[] }) => {
    const response = await api.post(`/v1/upload/ocel`, payload);
    return response.data;
};

export const deleteOcel = async (fileId: string) => {
    const response = await api.delete(`/v1/objects/ocel/${fileId}`);
    return response.data;
};

export const getConformanceOcptOcel = async (
    ocptFileId: string,
    ocelFileId: string
): Promise<{ fitness: number; precision: number }> => {
    const response = await api.get(`/v1/conformance/ocpt/${ocptFileId}/ocel/${ocelFileId}`);
    return response.data;
};

export const getConformanceOcptOcpt = async (
    ocptFileId1: string,
    ocptFileId2: string
): Promise<{ fitness: number; precision: number }> => {
    const response = await api.get(`/v1/conformance/ocpt_1/${ocptFileId1}/ocpt_2/${ocptFileId2}`);
    return response.data;
};

export const getOcelObjectTypes = async (fileId: string): Promise<CaseNotionApiResponse> => {
    const response = await api.get(`v1/objects/ocel/types/${fileId}`);
    return response.data;
};

export const mineOcpt = async (fileId: string, algorithm: string = 'DF2'): Promise<GetOcptResponse> => {
    if (algorithm === 'DF2') {
        const response = await api.get(`v1/ocpt/df2/${fileId}`);
        return response.data;
    } else if (algorithm === 'OCIM') {
        const response = await api.get(`v1/ocpt/ocim/${fileId}`);
        return response.data;
    }
    throw new Error(`Algorithm ${algorithm} not supported`);
};

export const getCaseNotions = async (cnFileId: string) => {
    const response = await api.get<GetCaseNotionsResponse>(`v1/case_notion/case_ocel/${cnFileId}`);
    return response.data;
};

export const getLogGraphs = async (ocelFileId: string) => {
    const response = await api.get(`v1/log_graphs/ocel/${ocelFileId}`);
    return response.data;
};

export const getOcelCollection = async (ocelCollectionFileId: string): Promise<CaseOcelResponse> => {
    const response = await api.get(`v1/objects/ocel_collection/${ocelCollectionFileId}`);
    return response.data;
};

export const getEventStreamInit = async (fileId: string): Promise<{ first_event: string; last_event: string; event_count: number }> => {
    const response = await api.get(`v1/event_stream/init/${fileId}`);
    return response.data;
};
