import styled from '@emotion/styled';

export const Wrapper = styled.div`
  position: relative;
  margin-left: 6px;
`;

export const GifButton = styled.button`
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 12px;
  font-weight: bold;
  color: #1d1c1d;
  cursor: pointer;

  &:hover,
  &.active {
    background: #f2f2f2;
  }
`;

export const Popover = styled.div`
  position: absolute;
  bottom: 34px;
  left: 0;
  width: 360px;
  max-width: calc(100vw - 32px);
  height: 380px;
  display: flex;
  flex-direction: column;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10;

  & > form {
    padding: 10px;
    border-bottom: 1px solid #eee;

    & input {
      width: 100%;
      box-sizing: border-box;
      height: 30px;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 0 8px;
      font-size: 13px;
    }
  }

  & > footer {
    padding: 4px 10px;
    font-size: 11px;
    color: #888;
    text-align: right;
    border-top: 1px solid #eee;
  }
`;

export const Grid = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-auto-rows: 110px;
  gap: 6px;

  & > button {
    padding: 0;
    border: none;
    border-radius: 4px;
    overflow: hidden;
    background: #f2f2f2;
    cursor: pointer;

    &:hover {
      outline: 2px solid #1264a3;
    }

    & img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }
`;

export const Message = styled.p`
  grid-column: 1 / -1;
  margin: 20px 10px;
  color: #616061;
  font-size: 13px;
  text-align: center;
  line-height: 1.5;
`;
