// 멘션 표기: @[닉네임](사용자 id), @[channel](channel), @[here](here), @[그룹이름](g그룹 id)
export const MENTION_MARKUP = /@\[(.+?)]\((\d+?|channel|here|g\d+)\)/g;

// 알림·미리보기용: 멘션 표기를 '@이름' 으로
export const plainMentions = (text: string) => text.replace(MENTION_MARKUP, '@$1');
