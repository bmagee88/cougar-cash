import React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import PromotionButton from './PromotionButton';
import {promoteTypingBossPlayer} from './api';
import {promotionContributions,readDevicePromotion} from './promotion';
declare const test:any,expect:any,jest:any,beforeEach:any,afterEach:any;
jest.mock('./api');
const token=`v1.${'a'.repeat(32)}.${'b'.repeat(64)}`;
beforeEach(()=>{localStorage.clear();jest.clearAllMocks();});afterEach(()=>localStorage.clear());
test('promotion uses a masked password, saves only the signed device grant, and prevents repeated promotion',async()=>{
  (promoteTypingBossPlayer as any).mockResolvedValueOnce({promotionToken:token,session:{}});
  render(<PromotionButton sessionId="bossABC" playerToken="private-token"/>);
  fireEvent.click(screen.getByRole('button',{name:'Promote character'}));
  const field=screen.getByLabelText('Host password');expect(field.getAttribute('type')).toBe('password');
  fireEvent.change(field,{target:{value:'abcde'}});expect(screen.getByTestId('promotion-password-mask').textContent).toBe('•'.repeat(10));
  fireEvent.click(screen.getByRole('button',{name:'Promote hero'}));
  await waitFor(()=>expect((screen.getByRole('button',{name:'Promoted · 2× damage'}) as HTMLButtonElement).disabled).toBe(true));
  expect(promoteTypingBossPlayer).toHaveBeenCalledWith('bossABC','private-token','abcde');expect(readDevicePromotion()).toBe(token);
  expect(Object.values(localStorage).join('')).not.toContain('abcde');
});
test('wrong passwords never create a device promotion and closing clears the password',async()=>{
  (promoteTypingBossPlayer as any).mockRejectedValueOnce(new Error('Incorrect room creation password.'));
  render(<PromotionButton sessionId="bossABC" playerToken="private-token"/>);
  fireEvent.click(screen.getByRole('button',{name:'Promote character'}));fireEvent.change(screen.getByLabelText('Host password'),{target:{value:'nope'}});
  fireEvent.click(screen.getByRole('button',{name:'Promote hero'}));await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Incorrect'));
  expect(readDevicePromotion()).toBe('');fireEvent.click(screen.getByRole('button',{name:'Close'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());fireEvent.click(screen.getByRole('button',{name:'Promote character'}));
  expect((screen.getByLabelText('Host password') as HTMLInputElement).value).toBe('');
});
test('three heroes with one promotion contribute four boss HP shares',()=>{
  expect(promotionContributions([{promoted:false},{promoted:false},{promoted:true}])).toBe(4);
});
