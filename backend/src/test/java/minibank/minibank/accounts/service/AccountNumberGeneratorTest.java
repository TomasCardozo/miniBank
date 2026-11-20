package minibank.minibank.accounts.service;

import minibank.minibank.accounts.repository.AccountRepository;
import org.junit.jupiter.api.Test;

import java.security.SecureRandom;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AccountNumberGeneratorTest {

    @Test
    void generateUniqueAccountNumberReturnsTwelveNumericDigits() {
        AccountRepository accountRepository = mock(AccountRepository.class);
        AccountNumberGenerator generator = new AccountNumberGenerator(
                accountRepository,
                new FixedDigitSecureRandom(1)
        );

        String accountNumber = generator.generateUniqueAccountNumber();

        assertThat(accountNumber).isEqualTo("111111111111");
        assertThat(accountNumber).hasSize(AccountNumberGenerator.ACCOUNT_NUMBER_LENGTH);
        assertThat(accountNumber).matches("^[0-9]{12}$");
    }

    @Test
    void generateUniqueAccountNumberKeepsLeadingZeroes() {
        AccountRepository accountRepository = mock(AccountRepository.class);
        AccountNumberGenerator generator = new AccountNumberGenerator(
                accountRepository,
                new FixedDigitSecureRandom(0)
        );

        String accountNumber = generator.generateUniqueAccountNumber();

        assertThat(accountNumber).isEqualTo("000000000000");
    }

    @Test
    void generateUniqueAccountNumberRetriesWhenCandidateAlreadyExists() {
        AccountRepository accountRepository = mock(AccountRepository.class);
        when(accountRepository.existsByAccountNumber("111111111111")).thenReturn(true);
        when(accountRepository.existsByAccountNumber("222222222222")).thenReturn(false);

        AccountNumberGenerator generator = new AccountNumberGenerator(
                accountRepository,
                new SequenceDigitSecureRandom(1, 2)
        );

        assertThat(generator.generateUniqueAccountNumber()).isEqualTo("222222222222");
    }

    @Test
    void generateUniqueAccountNumberFailsWhenAllAttemptsCollide() {
        AccountRepository accountRepository = mock(AccountRepository.class);
        when(accountRepository.existsByAccountNumber("111111111111")).thenReturn(true);
        AccountNumberGenerator generator = new AccountNumberGenerator(
                accountRepository,
                new FixedDigitSecureRandom(1)
        );

        assertThatThrownBy(generator::generateUniqueAccountNumber)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Could not generate a unique account number");
    }

    private static class FixedDigitSecureRandom extends SecureRandom {

        private final int digit;

        private FixedDigitSecureRandom(int digit) {
            this.digit = digit;
        }

        @Override
        public int nextInt(int bound) {
            return digit;
        }
    }

    private static class SequenceDigitSecureRandom extends SecureRandom {

        private final int firstDigit;
        private final int secondDigit;
        private int calls;

        private SequenceDigitSecureRandom(int firstDigit, int secondDigit) {
            this.firstDigit = firstDigit;
            this.secondDigit = secondDigit;
        }

        @Override
        public int nextInt(int bound) {
            calls++;
            if (calls <= AccountNumberGenerator.ACCOUNT_NUMBER_LENGTH) {
                return firstDigit;
            }
            return secondDigit;
        }
    }
}
