import styled from '@emotion/styled';
import React, { FC } from 'react';

const Wrapper = styled.div`
  padding: 32px 20px 12px;

  & > img {
    width: 72px;
    height: 72px;
    border-radius: 10px;
    margin-bottom: 12px;
  }

  & > .icon {
    width: 72px;
    height: 72px;
    border-radius: 10px;
    margin-bottom: 12px;
    background: #f2f2f2;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36px;
    font-weight: 800;
    color: #616061;
  }

  & > h3 {
    margin: 0 0 6px;
    font-size: 22px;
    font-weight: 800;
  }

  & > p {
    margin: 0;
    font-size: 15px;
    color: #616061;
    line-height: 1.5;
  }
`;

interface Props {
  image?: string;
  icon?: string;
  title: string;
  description: React.ReactNode;
}

// 대화(채널/DM)의 맨 처음에 보여주는 안내
const ConversationIntro: FC<Props> = ({ image, icon, title, description }) => (
  <Wrapper>
    {image ? <img src={image} alt="" /> : <div className="icon">{icon}</div>}
    <h3>{title}</h3>
    <p>{description}</p>
  </Wrapper>
);

export default ConversationIntro;
