import getLinkComponent from '~/components/ocpt/links/getLinkComponent';
import { type HierarchyPointLinkObjectCentric, type Node } from '~/types/ocpt/ocpt.types';

const LinkLine = getLinkComponent({
    layout: 'cartesian',
    linkType: 'line',
    orientation: 'vertical',
});

interface OcptLinkProps {
    link: HierarchyPointLinkObjectCentric<Node>;
    linkId: number;
}

const OcptLink: React.FC<OcptLinkProps> = ({ link, linkId }) => {
    return <LinkLine key={`${linkId}`} data={link} strokeWidth="1" stroke="#d1d5db" />;
};

export default OcptLink;
