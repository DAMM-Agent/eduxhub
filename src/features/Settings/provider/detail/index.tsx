import { Button } from '@lobehub/ui/base-ui';
import { isModelProvider } from 'model-bank/modelProvider';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import SurfaceSkeleton from '@/components/Skeleton/Surface';
import dynamic from '@/libs/next/dynamic';

const OpenAI = dynamic(() => import('./openai'), {
  loading: () => <SurfaceSkeleton header={false} variant={'form'} />,
  ssr: false,
});
const ProviderGrid = dynamic(() => import('../(list)/ProviderGrid'), {
  loading: () => <SurfaceSkeleton header={false} variant={'grid'} />,
  ssr: false,
});
const DefaultPage = dynamic(() => import('./default/ProviderDetialPage'), {
  loading: () => <SurfaceSkeleton header={false} variant={'form'} />,
  ssr: false,
});

type ProviderDetailPageProps = {
  id?: string | null;
  onProviderSelect: (provider: string) => void;
};

const ProviderDetailPage = (props: ProviderDetailPageProps) => {
  const { id, onProviderSelect } = props;

  const { t } = useTranslation(['error', 'common']);

  if (id === 'all' || !id) return <ProviderGrid onProviderSelect={onProviderSelect} />;
  if (!isModelProvider(id)) {
    return (
      <AsyncError
        description={id}
        title={t('response.UnsupportedProvider')}
        variant="page"
        action={
          <Button onClick={() => onProviderSelect('all')}>{t('back', { ns: 'common' })}</Button>
        }
      />
    );
  }
  return id === 'openai' ? <OpenAI /> : <DefaultPage id={id} />;
};

export default ProviderDetailPage;
