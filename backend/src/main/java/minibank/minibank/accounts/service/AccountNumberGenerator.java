package minibank.minibank.accounts.service;

import minibank.minibank.accounts.repository.AccountRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;

@Component
public class AccountNumberGenerator {

    static final int ACCOUNT_NUMBER_LENGTH = 12;
    private static final int MAX_GENERATION_ATTEMPTS = 10;
    private static final int DIGIT_BOUND = 10;

    private final AccountRepository accountRepository;
    private final SecureRandom secureRandom;

    @Autowired
    public AccountNumberGenerator(AccountRepository accountRepository) {
        this(accountRepository, new SecureRandom());
    }

    AccountNumberGenerator(AccountRepository accountRepository, SecureRandom secureRandom) {
        this.accountRepository = accountRepository;
        this.secureRandom = secureRandom;
    }

    public String generateUniqueAccountNumber() {
        for (int attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
            String accountNumber = generateAccountNumber();
            if (!accountRepository.existsByAccountNumber(accountNumber)) {
                return accountNumber;
            }
        }

        throw new IllegalStateException("Could not generate a unique account number");
    }

    private String generateAccountNumber() {
        StringBuilder accountNumber = new StringBuilder(ACCOUNT_NUMBER_LENGTH);
        for (int index = 0; index < ACCOUNT_NUMBER_LENGTH; index++) {
            accountNumber.append(secureRandom.nextInt(DIGIT_BOUND));
        }
        return accountNumber.toString();
    }
}
