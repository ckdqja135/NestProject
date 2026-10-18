import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GifItem {
  id: string;
  title: string;
  url: string; // 채팅에 보낼 GIF 주소
  previewUrl: string; // 검색 결과 썸네일
  width: number;
  height: number;
}

// 채팅에 넣을 수 있는 GIF 주소 (GIPHY 미디어 서버만 허용)
export const GIF_URL_PATTERN =
  /^https:\/\/media[0-9]?\.giphy\.com\/media\/[A-Za-z0-9]+\/[A-Za-z0-9_.-]+\.gif(\?[^\s]*)?$/;

const LIMIT = 24;

@Injectable()
export class GifsService {
  constructor(private configService: ConfigService) {}

  isEnabled() {
    return !!this.configService.get('GIPHY_API_KEY');
  }

  // GIPHY 검색 (키워드가 없으면 인기 GIF)
  async search(keyword: string | undefined, offset = 0): Promise<GifItem[]> {
    const apiKey = this.configService.get('GIPHY_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GIF 검색이 설정되지 않았습니다. 서버 .env 에 GIPHY_API_KEY 를 설정해주세요.',
      );
    }
    const baseUrl =
      this.configService.get('GIPHY_API_URL') || 'https://api.giphy.com/v1';
    const q = (keyword || '').trim().slice(0, 50);
    const params = new URLSearchParams({
      api_key: apiKey,
      limit: String(LIMIT),
      offset: String(Math.max(0, offset)),
      rating: 'g',
    });
    if (q) {
      params.set('q', q);
      params.set('lang', 'ko');
    }
    const endpoint = `${baseUrl}/gifs/${q ? 'search' : 'trending'}?${params}`;

    let body;
    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        throw new Error(`GIPHY ${response.status}`);
      }
      body = await response.json();
    } catch (error) {
      throw new BadGatewayException('GIF 검색 서비스에 연결하지 못했습니다.');
    }

    return (body?.data || [])
      .map((gif) => {
        const full = gif?.images?.fixed_height;
        const preview = gif?.images?.fixed_height_small || full;
        return {
          id: gif?.id,
          title: gif?.title || '',
          url: full?.url,
          previewUrl: preview?.url,
          width: Number(full?.width) || 0,
          height: Number(full?.height) || 0,
        };
      })
      .filter((gif: GifItem) => gif.id && GIF_URL_PATTERN.test(gif.url || ''));
  }
}
