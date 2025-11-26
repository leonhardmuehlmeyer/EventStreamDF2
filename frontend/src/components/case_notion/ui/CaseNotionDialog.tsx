import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Pickaxe } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '~/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '~/components/ui/select';
import { getAdvancedCN, getConnectedComponentsCN, getTraditionalCN } from '~/services/api';
import { useGetOcelObjectTypes } from '~/services/queries';

interface CaseNotionDialogProps {
    fileId: string | null;
    fileName: string;
}

const CaseNotionDialog = ({ fileId, fileName }: CaseNotionDialogProps) => {
    const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>('');

    const { data: ocelObjectTypesData } = useGetOcelObjectTypes(fileId);

    const { mutate, isPending, data } = useMutation({
        mutationFn: async (algorithm: string) => {
            if (!fileId) {
                throw new Error('File ID is not available.');
            }
            switch (algorithm) {
                case 'traditional':
                    return getTraditionalCN(fileId);
                case 'connected-component':
                    return getConnectedComponentsCN(fileId);
                case 'advanced':
                    return getAdvancedCN(fileId);
                default:
                    throw new Error(`Unknown or unsupported algorithm: ${algorithm}`);
            }
        },
        onSuccess: (data) => {
            console.log('Mining successful:', data);
            // Here you would handle the successful response,
            // e.g., update state to display the new data.
        },
        onError: (error) => {
            console.error('Mining failed:', error);
        },
    });

    const handleMineClick = async () => {
        if (ocelObjectTypesData) {
            console.log(ocelObjectTypesData.object_types);
        }

        if (selectedAlgorithm) {
            mutate(selectedAlgorithm);
        } else {
            console.warn('No algorithm selected.');
        }
    };

    return (
        <Dialog>
            <div className="p-4">
                <DialogTrigger asChild>
                    <Button variant="outline">View</Button>
                </DialogTrigger>
            </div>
            <DialogContent className="sm:max-w-[800px] md:max-w-[1000px] lg:max-w-[1200px] h-[80vh] w-full flex flex-col">
                <div className="flex flex-row flex-grow">
                    <div className="flex w-2/3">
                        <DialogHeader>
                            <DialogTitle>Case Notions</DialogTitle>
                            <DialogDescription>Choose a case notion mining algorithm</DialogDescription>
                        </DialogHeader>
                    </div>
                    <div className="w-px bg-border h-full mx-4"></div>
                    <div className="flex flex-col w-1/3">
                        <p className="font-bold">Settings</p>
                        <div className="flex mt-2 ">
                            <Select onValueChange={setSelectedAlgorithm} value={selectedAlgorithm}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select an algorithm" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Algorithms</SelectLabel>
                                        <SelectItem value="traditional">Traditional</SelectItem>
                                        <SelectItem value="generic" disabled>
                                            Generic (Not Implemented)
                                        </SelectItem>
                                        <SelectItem value="advanced">Advanced</SelectItem>
                                        <SelectItem value="connected-component">Connected Component</SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            <Select>
                                <SelectTrigger className="w-[180px] ml-2">
                                    <SelectValue placeholder="Select an object type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Object Types</SelectLabel>
                                        {ocelObjectTypesData?.object_types.map((objectType) => (
                                            <SelectItem key={objectType.name} value={objectType.name}>
                                                {objectType.name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            <Button
                                variant={'outline'}
                                onClick={handleMineClick}
                                disabled={!selectedAlgorithm || isPending}
                                className="h-10 w-10 ml-2"
                            >
                                {isPending ? 'd' : <Pickaxe />}
                            </Button>
                        </div>
                        <p className="font-bold mt-6">Measures</p>
                        {data && data.measures && data.measures.length > 0 && (
                            <div className="mt-2 overflow-auto max-h-[400px]">
                                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                        <tr>
                                            <th scope="col" className="px-6 py-3">
                                                Measure
                                            </th>
                                            <th scope="col" className="px-6 py-3">
                                                Value
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.measures.map(
                                            (measure: { name: string; value: number }, index: number) => (
                                                <tr
                                                    key={index}
                                                    className="bg-white border-b dark:bg-gray-800 dark:border-gray-700"
                                                >
                                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                                        {measure.name}
                                                    </td>
                                                    <td className="px-6 py-4">{measure.value.toFixed(4)}</td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter className=""></DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CaseNotionDialog;
