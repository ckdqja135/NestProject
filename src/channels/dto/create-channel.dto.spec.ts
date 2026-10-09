import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateChannelDto } from './create-channel.dto';

const errorsFor = async (name: string) =>
  validate(plainToInstance(CreateChannelDto, { name }));

describe('CreateChannelDto', () => {
  it.each(['공지사항', 'project-a', '디자인 리뷰'])(
    '%s 는 허용한다',
    async (name) => {
      expect(await errorsFor(name)).toHaveLength(0);
    },
  );

  it.each(['a/b', '질문?', '#일반', '100%', 'a\\b'])(
    '주소를 깨는 문자가 든 %s 는 거부한다',
    async (name) => {
      expect(await errorsFor(name)).not.toHaveLength(0);
    },
  );
});
