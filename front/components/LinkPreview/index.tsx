import fetcher from '@utils/fetcher';
import { Globe } from 'lucide-react';
import React, { FC, useState } from 'react';
import useSWR from 'swr';
import { Card } from './styles';

interface Preview {
  url: string;
  siteName: string | null;
  title: string;
  description: string | null;
  image: string | null;
}

// 메시지 속 링크의 제목·설명·그림 카드. 그림은 우리 서버를 거쳐 가져온다 (보는 사람 IP 가 바깥 사이트에 남지 않게)
const LinkPreview: FC<{ workspace: string; url: string }> = ({ workspace, url }) => {
  const { data } = useSWR<{ preview: Preview | null }>(
    `/api/workspaces/${workspace}/link-preview?url=${encodeURIComponent(url)}`,
    fetcher,
    { revalidateOnFocus: false, revalidateIfStale: false, dedupingInterval: 60 * 60_000, shouldRetryOnError: false },
  );
  const [imageFailed, setImageFailed] = useState(false);
  const preview = data?.preview;
  if (!preview) {
    return null;
  }
  return (
    <Card href={preview.url} target="_blank" rel="noopener noreferrer" className="link-preview">
      <div className="text">
        <span className="site">
          <Globe size={12} /> {preview.siteName}
        </span>
        <b className="title">{preview.title}</b>
        {preview.description && <span className="desc">{preview.description}</span>}
      </div>
      {preview.image && !imageFailed && (
        <img src={preview.image} alt="" loading="lazy" onError={() => setImageFailed(true)} />
      )}
    </Card>
  );
};

export default LinkPreview;
