import styled from '@emotion/styled';

export const Container = styled.div`
  display: flex;
  flex-wrap: wrap;
  height: calc(100vh - 38px);
  flex-flow: column;
  position: relative;
`;

export const Header = styled.header`
  height: 64px;
  display: flex;
  width: 100%;
  --saf-0: rgba(var(--sk_foreground_low, 29, 28, 29), 0.13);
  box-shadow: 0 1px 0 var(--saf-0);
  padding: 20px 16px 20px 20px;
  font-weight: bold;
  align-items: center;

  & > img {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    margin-right: 10px;
  }

  & > div {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }

  & strong {
    font-size: 16px;
  }

  & .me {
    font-weight: normal;
    color: #616061;
  }

  & small {
    font-size: 12px;
    font-weight: normal;
    color: #616061;
    margin-top: 2px;
  }

  & small.online {
    color: #007a5a;
  }
`;
