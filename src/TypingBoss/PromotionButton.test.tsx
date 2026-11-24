import React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import PromotionButton from './PromotionButton';
import {promoteTypingBossPlayer} from './api';
import {promotionContributions,readDevicePromotion} from './promotion';
declare const test:any,expect:any,jest:any,beforeEach:any,afterEach:any;
jest.mock('./api');
const token=`v1.${'a'.repeat(32)}.${'b'.repeat(64)}`;
beforeEach(()=>{localStorage.clear();jest.clearAllMocks();});afterEach(()=>localStorage.clear());
test('promotion uses a masked password, saves only the signed device grant, and allows switching tiers',async()=>{
  (promoteTypingBossPlayer as any).mockResolvedValueOnce({promotionToken:token,session:{}});
  render(<PromotionButton sessionId="bossABC" playerToken="private-token"/>);
  fireEvent.click(screen.getByRole('button',{name:'Promote character'}));
  const field=screen.getByLabelText('Host password');expect(field.getAttribute('type')).toBe('password');
  fireEvent.change(field,{target:{value:'abcde'}});expect(screen.getByTestId('promotion-password-mask').textContent).toBe('•'.repeat(10));
  fireEvent.click(screen.getByRole('button',{name:'Apply promotion'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  expect(promoteTypingBossPlayer).toHaveBeenCalledWith('bossABC','private-token','abcde',1);expect(readDevicePromotion()).toBe(token);
  expect(Object.values(localStorage).join('')).not.toContain('abcde');
  const doubleToken=`v2.2.${'a'.repeat(32)}.${'b'.repeat(64)}`;
  (promoteTypingBossPlayer as any).mockResolvedValueOnce({promotionToken:doubleToken,session:{}});
  fireEvent.click(screen.getByRole('button',{name:'Promoted · 2× damage'}));
  fireEvent.change(screen.getByLabelText('Promotion tier'),{target:{value:'2'}});
  fireEvent.change(screen.getByLabelText('Host password'),{target:{value:'abcde'}});
  fireEvent.click(screen.getByRole('button',{name:'Apply promotion'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.getByRole('button',{name:'Double Promoted · Normal damage'})).toBeTruthy();
  expect(promoteTypingBossPlayer).toHaveBeenLastCalledWith('bossABC','private-token','abcde',2);expect(readDevicePromotion()).toBe(doubleToken);
});
test('wrong passwords never create a device promotion and closing clears the password',async()=>{
  (promoteTypingBossPlayer as any).mockRejectedValueOnce(new Error('Incorrect room creation password.'));
  render(<PromotionButton sessionId="bossABC" playerToken="private-token"/>);
  fireEvent.click(screen.getByRole('button',{name:'Promote character'}));fireEvent.change(screen.getByLabelText('Host password'),{target:{value:'nope'}});
  fireEvent.click(screen.getByRole('button',{name:'Apply promotion'}));await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Incorrect'));
  expect(readDevicePromotion()).toBe('');fireEvent.click(screen.getByRole('button',{name:'Close'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());fireEvent.click(screen.getByRole('button',{name:'Promote character'}));
  expect((screen.getByLabelText('Host password') as HTMLInputElement).value).toBe('');
});
test('three heroes with one promotion contribute four boss HP shares',()=>{
  expect(promotionContributions([{promoted:false},{promoted:false},{promoted:true}])).toBe(4);
  expect(promotionContributions([{promotionLevel:0},{promotionLevel:1},{promotionLevel:2}])).toBe(4);
});

test('a host-assigned Double Promoted tier can be remembered without switching away first',async()=>{
  const doubleToken=`v2.2.${'a'.repeat(32)}.${'b'.repeat(64)}`;
  localStorage.setItem('typingBossDevicePromotion:v1',token);
  (promoteTypingBossPlayer as any).mockResolvedValueOnce({promotionToken:doubleToken,session:{}});
  render(<PromotionButton sessionId="bossABC" playerToken="private-token" promotionLevel={2} promoted={false}/>);
  fireEvent.click(screen.getByRole('button',{name:'Double Promoted · Normal damage'}));
  expect((screen.getByLabelText('Promotion tier') as HTMLSelectElement).value).toBe('2');
  fireEvent.change(screen.getByLabelText('Host password'),{target:{value:'abcde'}});
  fireEvent.click(screen.getByRole('button',{name:'Apply promotion'}));
  await waitFor(()=>expect(readDevicePromotion()).toBe(doubleToken));
  expect(promoteTypingBossPlayer).toHaveBeenCalledWith('bossABC','private-token','abcde',2);
});
