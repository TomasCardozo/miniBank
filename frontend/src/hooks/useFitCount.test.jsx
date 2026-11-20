import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useFitCount from './useFitCount';

function List({ items }) {
  const { containerRef, count } = useFitCount('.item', items.length);
  const visible = count ? items.slice(0, count) : items;

  return (
    <div ref={containerRef} data-testid="container">
      {visible.map((item) => (
        <p key={item} className="item">
          {item}
        </p>
      ))}
    </div>
  );
}

const ITEMS = ['uno', 'dos', 'tres', 'cuatro', 'cinco'];

describe('useFitCount', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows every item when nothing can be measured', () => {
    render(<List items={ITEMS} />);

    expect(screen.getAllByText(/./, { selector: '.item' })).toHaveLength(5);
  });

  it('keeps only the items that fit in the container height', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(130);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ height: 40 });

    render(<List items={ITEMS} />);

    expect(screen.getAllByText(/./, { selector: '.item' }).map((element) => element.textContent)).toEqual([
      'uno',
      'dos',
      'tres',
    ]);
  });
});
