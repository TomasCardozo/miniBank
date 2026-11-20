package minibank.minibank.movements.service;

import minibank.minibank.accounts.repository.AccountRepository;
import minibank.minibank.common.exception.BusinessException;
import minibank.minibank.common.exception.NotFoundException;
import minibank.minibank.movements.dto.MovementFilterRequest;
import minibank.minibank.movements.repository.MovementRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MovementServiceTest {

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private MovementRepository movementRepository;

    @Test
    void listOwnAccountMovementsRejectsInvertedDateRangeBeforeQueryingOwnership() {
        MovementService service = new MovementService(accountRepository, movementRepository);
        UUID userId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        var filter = new MovementFilterRequest(
                Instant.parse("2026-07-27T00:00:00Z"),
                Instant.parse("2026-07-26T00:00:00Z"),
                null
        );

        assertThatThrownBy(() -> service.listOwnAccountMovements(userId, accountId, filter, PageRequest.of(0, 10)))
                .isInstanceOf(BusinessException.class)
                .hasMessage("from must be before or equal to to");

        verify(accountRepository, never()).existsByIdAndUserId(any(), any());
        verify(movementRepository, never()).findAll(any(Specification.class), any(PageRequest.class));
    }

    @Test
    void listOwnAccountMovementsRejectsForeignOrMissingAccountAsNotFound() {
        MovementService service = new MovementService(accountRepository, movementRepository);
        UUID userId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        var filter = new MovementFilterRequest(null, null, null);

        when(accountRepository.existsByIdAndUserId(accountId, userId)).thenReturn(false);

        assertThatThrownBy(() -> service.listOwnAccountMovements(userId, accountId, filter, PageRequest.of(0, 10)))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Account not found");
    }

    @Test
    void listOwnAccountMovementsReturnsRepositoryPageWhenAccountBelongsToUser() {
        MovementService service = new MovementService(accountRepository, movementRepository);
        UUID userId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        var filter = new MovementFilterRequest(null, null, null);
        var pageable = PageRequest.of(0, 10);

        when(accountRepository.existsByIdAndUserId(accountId, userId)).thenReturn(true);
        when(movementRepository.findAll(any(Specification.class), eq(pageable))).thenReturn(new PageImpl<>(List.of()));

        var response = service.listOwnAccountMovements(userId, accountId, filter, pageable);

        assertThat(response.getTotalElements()).isZero();
    }
}
